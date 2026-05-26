import { and, eq, gte, min, sql, sum } from 'drizzle-orm';

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

  getDailyBreakdown = async (): Promise<
    Array<{ date: string; weekday: string; tokens: number }>
  > => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const lastSunday = new Date(now);
    lastSunday.setUTCDate(now.getUTCDate() - dayOfWeek);
    lastSunday.setUTCHours(0, 0, 0, 0);

    const rows = await this.db
      .select({
        day: sql<string>`(${usageEvents.occurredAt} AT TIME ZONE 'UTC')::date::text`,
        total: sum(usageEvents.weightedTokens),
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, this.userId), gte(usageEvents.occurredAt, lastSunday)))
      .groupBy(sql`(${usageEvents.occurredAt} AT TIME ZONE 'UTC')::date`)
      .orderBy(sql`(${usageEvents.occurredAt} AT TIME ZONE 'UTC')::date`);

    const map = new Map(rows.map((r) => [r.day, Number(r.total ?? 0)]));

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lastSunday);
      d.setUTCDate(lastSunday.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      return { date, tokens: map.get(date) ?? 0, weekday: weekdays[i] };
    });
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
