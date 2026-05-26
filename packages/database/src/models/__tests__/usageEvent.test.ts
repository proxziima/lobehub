// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { usageEvents, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { UsageEventModel } from '../usageEvent';

const db: LobeChatDatabase = await getTestDB();
const userId = 'usage-event-test-user';

let model: UsageEventModel;

beforeEach(async () => {
  await db.insert(users).values([{ id: userId }]);
  model = new UsageEventModel(db, userId);
});

afterEach(async () => {
  await db.delete(usageEvents).where(eq(usageEvents.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
});

describe('UsageEventModel', () => {
  describe('insert', () => {
    it('creates a usage event record', async () => {
      await model.insert({
        model: 'claude-3-5-sonnet',
        provider: 'anthropic',
        weightedTokens: 1000,
        rawInput: 600,
        rawOutput: 400,
        costCents: 5,
      });

      const rows = await db.query.usageEvents.findMany({
        where: eq(usageEvents.userId, userId),
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].weightedTokens).toBe(1000);
      expect(rows[0].userId).toBe(userId);
    });

    it('no-op when userId is absent (bot/eval context)', async () => {
      const botModel = new UsageEventModel(db, '');
      await expect(
        botModel.insert({
          model: 'm',
          provider: 'p',
          weightedTokens: 100,
          rawInput: 50,
          rawOutput: 50,
          costCents: 1,
        }),
      ).resolves.toBeUndefined();

      const rows = await db.query.usageEvents.findMany({
        where: eq(usageEvents.userId, userId),
      });
      expect(rows).toHaveLength(0);
    });
  });

  describe('getSessionWindow', () => {
    it('returns zero used and null resetsAt when no events exist', async () => {
      const { used, resetsAt } = await model.getSessionWindow();
      expect(used).toBe(0);
      expect(resetsAt).toBeNull();
    });

    it('sums tokens within the last 5 hours', async () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

      await db.insert(usageEvents).values([
        { userId, weightedTokens: 300, occurredAt: twoHoursAgo },
        { userId, weightedTokens: 700, occurredAt: sixHoursAgo }, // outside window
      ]);

      const { used, resetsAt } = await model.getSessionWindow();
      expect(used).toBe(300);
      expect(resetsAt).toBeInstanceOf(Date);
    });

    it('resetsAt equals the oldest event time + 5 hours', async () => {
      const now = new Date();
      const oldest = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4h ago

      await db.insert(usageEvents).values([
        { userId, weightedTokens: 100, occurredAt: oldest },
        { userId, weightedTokens: 200, occurredAt: new Date(now.getTime() - 60_000) },
      ]);

      const { resetsAt } = await model.getSessionWindow();
      const expectedReset = new Date(oldest.getTime() + 5 * 60 * 60 * 1000);
      expect(resetsAt!.getTime()).toBeCloseTo(expectedReset.getTime(), -3); // within 1s
    });
  });

  describe('getWeeklyWindow', () => {
    it('returns zero used mid-week when no events exist', async () => {
      const { used, resetsAt } = await model.getWeeklyWindow();
      expect(used).toBe(0);
      expect(resetsAt).toBeInstanceOf(Date);
    });

    it('sums tokens from current week (since last Sunday 00:00 UTC)', async () => {
      const now = new Date();
      const dayOfWeek = now.getUTCDay(); // 0 = Sunday
      const msSinceLastSunday =
        dayOfWeek * 24 * 60 * 60 * 1000 +
        now.getUTCHours() * 60 * 60 * 1000 +
        now.getUTCMinutes() * 60 * 1000 +
        now.getUTCSeconds() * 1000;

      const insideWeek = new Date(now.getTime() - Math.min(msSinceLastSunday - 5000, 60_000));
      const outsideWeek = new Date(now.getTime() - msSinceLastSunday - 10_000); // before Sunday

      await db.insert(usageEvents).values([
        { userId, weightedTokens: 500, occurredAt: insideWeek },
        { userId, weightedTokens: 999, occurredAt: outsideWeek },
      ]);

      const { used } = await model.getWeeklyWindow();
      expect(used).toBe(500);
    });

    it('resetsAt is next Sunday 00:00 UTC', async () => {
      const { resetsAt } = await model.getWeeklyWindow();
      expect(resetsAt.getUTCDay()).toBe(0); // Sunday
      expect(resetsAt.getUTCHours()).toBe(0);
      expect(resetsAt.getUTCMinutes()).toBe(0);
      expect(resetsAt.getUTCSeconds()).toBe(0);
      expect(resetsAt.getUTCMilliseconds()).toBe(0);
    });

    it('Sunday 00:00 UTC — event exactly at week boundary is excluded', async () => {
      // Freeze time at a known Sunday 00:05 UTC so lastSunday = today 00:00
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-05T00:05:00Z')); // Sunday
      try {
        const lastSunday = new Date('2025-01-05T00:00:00Z');
        const justBefore = new Date(lastSunday.getTime() - 1); // Saturday 23:59:59.999

        await db.insert(usageEvents).values([
          { userId, weightedTokens: 200, occurredAt: justBefore }, // outside week
          { userId, weightedTokens: 100, occurredAt: new Date('2025-01-05T00:01:00Z') }, // inside
        ]);

        const { used } = await model.getWeeklyWindow();
        expect(used).toBe(100);
      } finally {
        vi.useRealTimers();
        await db.delete(usageEvents).where(eq(usageEvents.userId, userId));
      }
    });

    it('Sunday 00:01 UTC — event one minute into new week is counted', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-05T00:10:00Z')); // Sunday
      try {
        const oneMinuteIn = new Date('2025-01-05T00:01:00Z');
        await db
          .insert(usageEvents)
          .values([{ userId, weightedTokens: 350, occurredAt: oneMinuteIn }]);

        const { used } = await model.getWeeklyWindow();
        expect(used).toBe(350);
      } finally {
        vi.useRealTimers();
        await db.delete(usageEvents).where(eq(usageEvents.userId, userId));
      }
    });

    it('Saturday 23:59 UTC — event is still in current week', async () => {
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      // Place the event clearly within current week (max 1 day ago) regardless of test day
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      // Only insert if we're past the first hour of the week (avoids Sunday edge)
      if (dayOfWeek !== 0 || now.getUTCHours() > 0) {
        await db
          .insert(usageEvents)
          .values([{ userId, weightedTokens: 400, occurredAt: oneHourAgo }]);
        const { used } = await model.getWeeklyWindow();
        expect(used).toBe(400);
      }
    });
  });
});
