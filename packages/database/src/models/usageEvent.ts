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

  getSessionWindow = async (windowHours = 5): Promise<{ used: number; resetsAt: Date | null }> => {
    const windowMs = windowHours * 3_600_000;
    const windowStart = new Date(Date.now() - windowMs);

    const [row] = await this.db
      .select({
        oldestAt: min(usageEvents.occurredAt),
        total: sum(usageEvents.weightedTokens),
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, this.userId), gte(usageEvents.occurredAt, windowStart)));

    if (!row?.total) return { resetsAt: null, used: 0 };

    const resetsAt = row.oldestAt ? new Date(new Date(row.oldestAt).getTime() + windowMs) : null;

    return { resetsAt, used: Number(row.total) };
  };

  getDailyBreakdown = async (
    windowStart: Date,
    timezone = 'UTC',
  ): Promise<Array<{ date: string; weekday: string; tokens: number }>> => {
    // Embed timezone as a literal so SELECT/GROUP BY/ORDER BY share the same expression text.
    // PostgreSQL error 42803 occurs when the same column appears with different bind parameters
    // ($1 vs $4) across SELECT and GROUP BY — the planner can't prove $1 === $4 at parse time.
    const safeTz = timezone.replaceAll(/[^\w/+-]/g, '');
    const dayExpr = sql<string>`(${usageEvents.occurredAt} AT TIME ZONE '${sql.raw(safeTz)}')::date`;
    const rows = await this.db
      .select({
        day: sql<string>`${dayExpr}::text`,
        total: sum(usageEvents.weightedTokens),
      })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, this.userId), gte(usageEvents.occurredAt, windowStart)))
      .groupBy(dayExpr)
      .orderBy(dayExpr);

    const map = new Map(rows.map((r) => [r.day, Number(r.total ?? 0)]));

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(windowStart.getTime() + i * 86_400_000);
      const date = d.toISOString().slice(0, 10);
      return { date, tokens: map.get(date) ?? 0, weekday: weekdays[i] };
    });
  };

  getWeeklyWindow = async (
    windowStart: Date,
    resetsAt: Date,
  ): Promise<{ used: number; resetsAt: Date }> => {
    const [row] = await this.db
      .select({ total: sum(usageEvents.weightedTokens) })
      .from(usageEvents)
      .where(and(eq(usageEvents.userId, this.userId), gte(usageEvents.occurredAt, windowStart)));

    return { resetsAt, used: Number(row?.total ?? 0) };
  };
}
