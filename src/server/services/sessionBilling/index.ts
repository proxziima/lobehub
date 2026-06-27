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

const envFloat = (key: string, def: number) => {
  const v = process.env[key];
  return v ? Number.parseFloat(v) : def;
};

export const SESSION_BILLING_ENABLED = () => process.env.SESSION_BILLING_ENABLED === 'true';

const PLAN_PRESETS = {
  max20: { peakMultiplier: 1, session: 220_000, weekly: 2_000_000, windowHours: 5 },
  max5: { peakMultiplier: 1, session: 88_000, weekly: 700_000, windowHours: 5 },
  pro: { peakMultiplier: 1, session: 44_000, weekly: 350_000, windowHours: 5 },
} as const;

const planDefaults = () =>
  PLAN_PRESETS[process.env.SESSION_PLAN as keyof typeof PLAN_PRESETS] ?? null;

export const PEAK_MULTIPLIER = () =>
  envFloat('SESSION_BILLING_PEAK_MULTIPLIER', planDefaults()?.peakMultiplier ?? 1.5);
export const SESSION_LIMIT = () =>
  envInt('SESSION_LIMIT_TOKENS', planDefaults()?.session ?? 200_000);
export const SESSION_WINDOW_HOURS = () =>
  envInt('SESSION_WINDOW_HOURS', planDefaults()?.windowHours ?? 5);
export const WEEKLY_LIMIT = () =>
  envInt('SESSION_LIMIT_TOKENS_WEEKLY', planDefaults()?.weekly ?? 1_000_000);
export const COST_MARKUP = () => envFloat('SESSION_BILLING_COST_MARKUP', 1);

export const computeWeekBoundaries = (timezone = 'UTC'): { resetsAt: Date; windowStart: Date } => {
  const now = dayjs().tz(timezone);
  const lastSunday = now.subtract(now.day(), 'day').startOf('day');
  return {
    resetsAt: lastSunday.add(7, 'day').toDate(),
    windowStart: lastSunday.toDate(),
  };
};

/**
 * Returns 2 during peak hours (05:00–11:00 PT, exclusive upper bound). DST-aware.
 */
export const peakMultiplier = (date: Date): number => {
  const hour = dayjs(date).tz(PEAK_TZ).hour();
  return hour >= PEAK_START && hour < PEAK_END ? PEAK_MULTIPLIER() : 1;
};

export type DailyBreakdownItem = { date: string; weekday: string; tokens: number };

export type BudgetCheck = {
  session: { used: number; limit: number; resetsAt: Date | null; isPeak: boolean };
  weekly: { used: number; limit: number; resetsAt: Date };
};

export type BudgetSnapshot = BudgetCheck & {
  weekly: BudgetCheck['weekly'] & { dailyBreakdown: DailyBreakdownItem[] };
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
  const costCents = (modelUsage.cost ?? 0) * COST_MARKUP() * 100;

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

export const checkBudget = async (
  userId: string,
  db: LobeChatDatabase,
  timezone?: string,
): Promise<BudgetCheck> => {
  const eventModel = new UsageEventModel(db, userId);
  const { windowStart, resetsAt } = computeWeekBoundaries(timezone);
  const [sessionWindow, weeklyWindow] = await Promise.all([
    eventModel.getSessionWindow(SESSION_WINDOW_HOURS()),
    eventModel.getWeeklyWindow(windowStart, resetsAt),
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

export const getBudget = async (
  userId: string,
  db: LobeChatDatabase,
  timezone?: string,
): Promise<BudgetSnapshot> => {
  const eventModel = new UsageEventModel(db, userId);
  const { windowStart, resetsAt } = computeWeekBoundaries(timezone);
  const [check, dailyBreakdown] = await Promise.all([
    checkBudget(userId, db, timezone),
    eventModel.getDailyBreakdown(windowStart, timezone),
  ]);

  return {
    ...check,
    weekly: { ...check.weekly, dailyBreakdown },
  };
};

export class SessionLimitExceededError extends TRPCError {
  constructor(params: {
    resetsAt: Date | null;
    used: number;
    limit: number;
    limitType: 'session' | 'weekly';
  }) {
    super({
      code: 'FORBIDDEN',
      message: 'Session token limit exceeded',
      cause: {
        data: {
          code: 'SESSION_LIMIT_EXCEEDED',
          limit: params.limit,
          limitType: params.limitType,
          resetsAt: params.resetsAt?.toISOString() ?? null,
          used: params.used,
        },
      },
    });
  }
}

/**
 * Throws SessionLimitExceededError when used > limit (strict greater-than).
 * Pass a pre-fetched BudgetCheck to avoid an extra DB round-trip.
 */
export const assertBudget = async (userId: string, budget: BudgetCheck): Promise<void> => {
  if (!SESSION_BILLING_ENABLED()) return;
  if (!userId) return;

  const { session, weekly } = budget;

  if (session.used >= session.limit) {
    throw new SessionLimitExceededError({
      limit: session.limit,
      limitType: 'session',
      resetsAt: session.resetsAt,
      used: session.used,
    });
  }

  if (weekly.used >= weekly.limit) {
    throw new SessionLimitExceededError({
      limit: weekly.limit,
      limitType: 'weekly',
      resetsAt: weekly.resetsAt,
      used: weekly.used,
    });
  }
};
