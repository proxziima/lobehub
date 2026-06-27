import { ModelUsageSchema } from '@lobechat/types';
import { z } from 'zod';

import { UserModel } from '@/database/models/user';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { getBudget, recordUsage, SESSION_BILLING_ENABLED } from '@/server/services/sessionBilling';

export const subscriptionRouter = router({
  getBudget: authedProcedure.use(serverDatabase).query(async ({ ctx }) => {
    const userModel = new UserModel(ctx.serverDB, ctx.userId);
    const settings = await userModel.getUserSettings();
    const timezone = (settings?.general as Record<string, unknown>)?.timezone as string | undefined;
    return getBudget(ctx.userId, ctx.serverDB, timezone);
  }),

  recordUsage: authedProcedure
    .use(serverDatabase)
    .input(
      z.object({
        messageId: z.string(),
        model: z.string(),
        provider: z.string(),
        modelUsage: ModelUsageSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!SESSION_BILLING_ENABLED()) return;
      await recordUsage({
        db: ctx.serverDB,
        messageId: input.messageId,
        model: input.model,
        modelUsage: input.modelUsage,
        provider: input.provider,
        userId: ctx.userId,
      });
    }),
});
