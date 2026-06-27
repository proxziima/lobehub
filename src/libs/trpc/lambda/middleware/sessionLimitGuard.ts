import type { LobeChatDatabase } from '@lobechat/database';

import { UserModel } from '@/database/models/user';
import {
  assertBudget,
  checkBudget,
  SESSION_BILLING_ENABLED,
} from '@/server/services/sessionBilling';

import { trpc } from '../init';

interface ContextWithServerDB {
  serverDB?: LobeChatDatabase;
  userId?: string | null;
}

/**
 * Guards aiChatProcedure — throws SESSION_LIMIT_EXCEEDED when the user's
 * rolling 5-hour or weekly token budget is exhausted.
 * Requires serverDatabase middleware to be applied first.
 * No-op when SESSION_BILLING_ENABLED is not 'true'.
 */
export const sessionLimitGuard = trpc.middleware(async (opts) => {
  const ctx = opts.ctx as ContextWithServerDB;

  if (!SESSION_BILLING_ENABLED() || !ctx.userId || !ctx.serverDB) {
    return opts.next();
  }

  const userModel = new UserModel(ctx.serverDB, ctx.userId);
  const settings = await userModel.getUserSettings();
  const timezone = (settings?.general as Record<string, unknown>)?.timezone as string | undefined;

  const budget = await checkBudget(ctx.userId, ctx.serverDB, timezone);
  await assertBudget(ctx.userId, budget);

  return opts.next();
});
