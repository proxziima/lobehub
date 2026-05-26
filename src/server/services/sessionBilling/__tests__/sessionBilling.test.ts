import type { ModelUsage } from '@lobechat/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import { assertBudget, peakMultiplier, recordUsage } from '../index';

vi.mock('@/database/models/usageEvent', () => ({
  UsageEventModel: vi.fn(),
}));

// --------------- peakMultiplier ---------------

describe('peakMultiplier', () => {
  it('returns 1 for off-peak (noon PT = 20:00 UTC on non-DST day)', () => {
    // Jan 15 2025 20:00 UTC = Jan 15 12:00 PT (PST, UTC-8) — well outside [5,11)
    const date = new Date('2025-01-15T20:00:00Z');
    expect(peakMultiplier(date)).toBe(1);
  });

  it('returns multiplier for peak (08:00 PT = 16:00 UTC on non-DST day)', () => {
    // Jan 15 2025 16:00 UTC = Jan 15 08:00 PT — inside [5,11)
    const date = new Date('2025-01-15T16:00:00Z');
    expect(peakMultiplier(date)).toBe(Number(process.env.SESSION_BILLING_PEAK_MULTIPLIER ?? 2));
  });

  it('returns multiplier at exactly 05:00 PT (peak boundary — inclusive)', () => {
    // Jan 15 2025 13:00 UTC = Jan 15 05:00 PT (PST)
    const date = new Date('2025-01-15T13:00:00Z');
    expect(peakMultiplier(date)).toBe(Number(process.env.SESSION_BILLING_PEAK_MULTIPLIER ?? 2));
  });

  it('returns 1 at exactly 11:00 PT (off-peak boundary — exclusive)', () => {
    // Jan 15 2025 19:00 UTC = Jan 15 11:00 PT (PST)
    const date = new Date('2025-01-15T19:00:00Z');
    expect(peakMultiplier(date)).toBe(1);
  });

  it('spring-forward 2024-03-10 01:59 PT — pre-transition, off-peak', () => {
    // 01:59 PT is outside [5,11), off-peak regardless of DST
    const date = new Date('2024-03-10T09:59:00Z'); // UTC 09:59 = PST 01:59
    expect(peakMultiplier(date)).toBe(1);
  });

  it('spring-forward 2024-03-10 03:01 PDT — clocks jumped, off-peak', () => {
    // After spring forward clocks jump from 2:00 to 3:00; 03:01 PDT = UTC 10:01
    // 03:01 PDT is outside [5,11), off-peak
    const date = new Date('2024-03-10T10:01:00Z'); // UTC 10:01 = PDT 03:01
    expect(peakMultiplier(date)).toBe(1);
  });

  it('fall-back 2024-11-03 — 06:00 PT is still peak in both clock readings', () => {
    // Nov 3 14:00 UTC: during fall-back, 14:00 UTC = 06:00 PST (after fall-back) — peak
    const date = new Date('2024-11-03T14:00:00Z');
    expect(peakMultiplier(date)).toBe(Number(process.env.SESSION_BILLING_PEAK_MULTIPLIER ?? 2));
  });

  it('fall-back 2024-11-03 ambiguous hour at 10:30 PT — still peak', () => {
    // Nov 3 18:30 UTC = 10:30 PST (after fall-back) — still before 11, peak
    const date = new Date('2024-11-03T18:30:00Z');
    expect(peakMultiplier(date)).toBe(Number(process.env.SESSION_BILLING_PEAK_MULTIPLIER ?? 2));
  });
});

// --------------- recordUsage ---------------

describe('recordUsage', () => {
  let insertMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    insertMock = vi.fn().mockResolvedValue(undefined);
    const { UsageEventModel } = await import('@/database/models/usageEvent');
    vi.mocked(UsageEventModel).mockImplementation(() => ({ insert: insertMock }) as any);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const mockDb = {} as LobeChatDatabase;
  const baseParams = {
    userId: 'user-1',
    messageId: 'msg-1',
    model: 'claude-3-5-sonnet',
    provider: 'anthropic',
    db: mockDb,
  };

  it('stores weightedTokens = totalTokens * peakMultiplier during peak', async () => {
    // Jan 15 2025 16:00 UTC = 08:00 PST — inside [5,11), peak
    vi.setSystemTime(new Date('2025-01-15T16:00:00Z'));
    const peakMult = Number(process.env.SESSION_BILLING_PEAK_MULTIPLIER ?? 2);

    const usage: ModelUsage = { totalTokens: 500, totalInputTokens: 300, totalOutputTokens: 200 };
    await recordUsage({ ...baseParams, modelUsage: usage });

    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ weightedTokens: 500 * peakMult }),
    );
  });

  it('stores weightedTokens = totalTokens * 1 during off-peak', async () => {
    // Jan 15 2025 20:00 UTC = 12:00 PST — outside [5,11), off-peak
    vi.setSystemTime(new Date('2025-01-15T20:00:00Z'));

    const usage: ModelUsage = { totalTokens: 500, totalInputTokens: 300, totalOutputTokens: 200 };
    await recordUsage({ ...baseParams, modelUsage: usage });

    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ weightedTokens: 500 }));
  });

  it('no-op when userId is undefined', async () => {
    const usage: ModelUsage = { totalTokens: 100 };
    await recordUsage({ ...baseParams, userId: undefined, modelUsage: usage });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('no-op when totalTokens is 0', async () => {
    const usage: ModelUsage = { totalTokens: 0, totalInputTokens: 0, totalOutputTokens: 0 };
    await recordUsage({ ...baseParams, modelUsage: usage });

    expect(insertMock).not.toHaveBeenCalled();
  });
});

// --------------- assertBudget boundary tests (direct via env limits) ---------------

describe('assertBudget boundary (SESSION_BILLING_ENABLED)', () => {
  let origEnabled: string | undefined;
  let origLimit: string | undefined;
  let origWeeklyLimit: string | undefined;

  beforeEach(() => {
    origEnabled = process.env.SESSION_BILLING_ENABLED;
    origLimit = process.env.SESSION_LIMIT_TOKENS;
    origWeeklyLimit = process.env.SESSION_LIMIT_TOKENS_WEEKLY;
    process.env.SESSION_BILLING_ENABLED = 'true';
    process.env.SESSION_LIMIT_TOKENS = '1000';
    process.env.SESSION_LIMIT_TOKENS_WEEKLY = '5000';
  });

  afterEach(() => {
    process.env.SESSION_BILLING_ENABLED = origEnabled;
    process.env.SESSION_LIMIT_TOKENS = origLimit;
    process.env.SESSION_LIMIT_TOKENS_WEEKLY = origWeeklyLimit;
    vi.restoreAllMocks();
  });

  it('passes when used is under session limit', async () => {
    await expect(
      assertBudget('user', {
        session: { used: 999, limit: 1000, resetsAt: null, isPeak: false },
        weekly: { used: 0, limit: 5000, resetsAt: new Date() },
      }),
    ).resolves.toBeUndefined();
  });

  it('passes when billing is disabled regardless of usage', async () => {
    process.env.SESSION_BILLING_ENABLED = 'false';
    await expect(
      assertBudget('any-user', {
        session: { used: 999_999, limit: 1000, resetsAt: null, isPeak: false },
        weekly: { used: 999_999, limit: 5000, resetsAt: new Date() },
      }),
    ).resolves.toBeUndefined();
  });

  it('passes when used === limit (strict > check)', async () => {
    await expect(
      assertBudget('user', {
        session: { used: 1000, limit: 1000, resetsAt: null, isPeak: false },
        weekly: { used: 0, limit: 5000, resetsAt: new Date() },
      }),
    ).resolves.toBeUndefined();
  });

  it('throws SESSION_LIMIT_EXCEEDED when session used > limit', async () => {
    await expect(
      assertBudget('user', {
        session: { used: 1001, limit: 1000, resetsAt: new Date(), isPeak: false },
        weekly: { used: 0, limit: 5000, resetsAt: new Date() },
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('throws SESSION_LIMIT_EXCEEDED when weekly used > limit', async () => {
    await expect(
      assertBudget('user', {
        session: { used: 0, limit: 1000, resetsAt: null, isPeak: false },
        weekly: { used: 5001, limit: 5000, resetsAt: new Date() },
      }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
