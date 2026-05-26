import type { ModelUsage } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import dayjs from 'dayjs';
import timezonePlugin from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

import { UsageEventModel } from '@/database/models/usageEvent';
import type { LobeChatDatabase } from '@/database/type';

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

const PEAK_TZ = 'America/Los_Angeles';
const PEAK_START = 5; // 05:00 PT inclusive
const PEAK_END = 11; // 11:00 PT exclusive

const envInt = (key: string, def: number) => {
  const v = process.env[key];
  return v ? Number.parseInt(v, 10) : def;
};

export const SESSION_BILLING_ENABLED = () => process.env.SESSION_BILLING_ENABLED === 'true';

export const PEAK_MULTIPLIER = () => envInt('SESSION_BILLING_PEAK_MULTIPLIER', 2);

export const SESSION_LIMIT = () => envInt('SESSION_LIMIT_TOKENS', 200_000);

export const WEEKLY_LIMIT = () => envInt('SESSION_LIMIT_TOKENS_WEEKLY', 1_000_000);

export const COST_MARKUP = () => {
  const v = process.env.SESSION_BILLING_COST_MARKUP;
  return v ? Number.parseFloat(v) : 1;
};

/**
 * Returns 2 during peak hours (05:00–11:00 PT, exclusive upper bound). DST-aware.
 */
export const peakMultiplier = (date: Date): number => {
  const hour = dayjs(date).tz(PEAK_TZ).hour();
  return hour >= PEAK_START && hour < PEAK_END ? PEAK_MULTIPLIER() : 1;
};

export type BudgetSnapshot = {
  session: { used: number; limit: number; resetsAt: Date | null; isPeak: boolean };
  weekly: { used: number; limit: number; resetsAt: Date };
};

export const recordUsage = async (params: {
  userId: string | undefined;
  messageId: string;
  model: string;
  provider: string;
  modelUsage: ModelUsage;
  db: LobeChatDatabase;
}): Promise<void> => {
  if (!params.userId) return;

  const { userId, messageId, model, provider, modelUsage, db } = params;
  const rawTokens =
    modelUsage.totalTokens ??
    (modelUsage.totalInputTokens ?? 0) + (modelUsage.totalOutputTokens ?? 0);

  if (rawTokens === 0) return;

  const now = new Date();
  const weightedTokens = rawTokens * peakMultiplier(now);
  const costCents = Math.round((modelUsage.cost ?? 0) * COST_MARKUP() * 100);

  const eventModel = new UsageEventModel(db, userId);
  await eventModel.insert({
    messageId,
    model,
    provider,
    weightedTokens,
    rawInput: modelUsage.totalInputTokens ?? 0,
    rawOutput: modelUsage.totalOutputTokens ?? 0,
    costCents,
  });
};

export const getBudget = async (userId: string, db: LobeChatDatabase): Promise<BudgetSnapshot> => {
  const eventModel = new UsageEventModel(db, userId);
  const [sessionWindow, weeklyWindow] = await Promise.all([
    eventModel.getSessionWindow(),
    eventModel.getWeeklyWindow(),
  ]);

  return {
    session: {
      isPeak: peakMultiplier(new Date()) > 1,
      limit: SESSION_LIMIT(),
      resetsAt: sessionWindow.resetsAt,
      used: sessionWindow.used,
    },
    weekly: {
      limit: WEEKLY_LIMIT(),
      resetsAt: weeklyWindow.resetsAt,
      used: weeklyWindow.used,
    },
  };
};

export class SessionLimitExceededError extends TRPCError {
  constructor(params: { resetsAt: Date | null; used: number; limit: number }) {
    super({
      code: 'FORBIDDEN',
      message: 'Session token limit exceeded',
      cause: {
        data: {
          code: 'SESSION_LIMIT_EXCEEDED',
          limit: params.limit,
          resetsAt: params.resetsAt?.toISOString() ?? null,
          used: params.used,
        },
      },
    });
  }
}

/**
 * Throws SessionLimitExceededError when used > limit (strict greater-than).
 * Pass a pre-fetched budget snapshot to avoid an extra DB round-trip.
 */
export const assertBudget = async (userId: string, budget: BudgetSnapshot): Promise<void> => {
  if (!SESSION_BILLING_ENABLED()) return;
  if (!userId) return;

  const { session, weekly } = budget;

  if (session.used > session.limit) {
    throw new SessionLimitExceededError({
      limit: session.limit,
      resetsAt: session.resetsAt,
      used: session.used,
    });
  }

  if (weekly.used > weekly.limit) {
    throw new SessionLimitExceededError({
      limit: weekly.limit,
      resetsAt: weekly.resetsAt,
      used: weekly.used,
    });
  }
};
