import { and, eq, gte, min, sum } from 'drizzle-orm';

import { usageEvents } from '../schemas/usageEvents';
import type { LobeChatDatabase } from '../type';

export class UsageEventModel {
  private db: LobeChatDatabase;
  private userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  insert = async (params: {
    messageId?: string;
    model: string;
    provider: string;
    weightedTokens: number;
    rawInput: number;
    rawOutput: number;
    costCents: number;
  }): Promise<void> => {
    if (!this.userId) return;

    await this.db.insert(usageEvents).values({
      ...params,
      userId: this.userId,
    });
  };

  getSessionWindow = async (): Promise<{ used: number; resetsAt: Date | null }> => {
    const windowStart = new Date(Date.now() - 5 * 60 * 60 * 1000);

    const [row] = await this.db
      .select({
        oldestAt: min(usageEvents.occurredAt),
        total: sum(usageEvents.weightedTokens),
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, this.userId), gte(usageEvents.occurredAt, windowStart)));

    if (!row?.total) return { resetsAt: null, used: 0 };

    const resetsAt = row.oldestAt
      ? new Date(new Date(row.oldestAt).getTime() + 5 * 60 * 60 * 1000)
      : null;

    return { resetsAt, used: Number(row.total) };
  };

  getWeeklyWindow = async (): Promise<{ used: number; resetsAt: Date }> => {
    const now = new Date();

    // Last Sunday 00:00 UTC
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday
    const lastSunday = new Date(now);
    lastSunday.setUTCDate(now.getUTCDate() - dayOfWeek);
    lastSunday.setUTCHours(0, 0, 0, 0);

    // Next Sunday 00:00 UTC
    const nextSunday = new Date(lastSunday);
    nextSunday.setUTCDate(lastSunday.getUTCDate() + 7);

    const [row] = await this.db
      .select({ total: sum(usageEvents.weightedTokens) })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, this.userId), gte(usageEvents.occurredAt, lastSunday)));

    return { resetsAt: nextSunday, used: Number(row?.total ?? 0) };
  };
}
