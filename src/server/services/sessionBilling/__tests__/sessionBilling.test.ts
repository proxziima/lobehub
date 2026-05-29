import type { ModelUsage } from '@lobechat/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LobeChatDatabase } from '@/database/type';

import {
  assertBudget,
  computeWeekBoundaries,
  PEAK_MULTIPLIER,
  peakMultiplier,
  recordUsage,
  SESSION_LIMIT,
  SESSION_WINDOW_HOURS,
  WEEKLY_LIMIT,
} from '../index';

vi.mock('@/database/models/usageEvent', () => ({
  UsageEventModel: vi.fn(),
}));

// --------------- SESSION_PLAN presets ---------------

describe('SESSION_PLAN presets', () => {
  let origPlan: string | undefined;
  let origSession: string | undefined;
  let origWeekly: string | undefined;
  let origWindow: string | undefined;
  let origPeak: string | undefined;

  beforeEach(() => {
    origPlan = process.env.SESSION_PLAN;
    origSession = process.env.SESSION_LIMIT_TOKENS;
    origWeekly = process.env.SESSION_LIMIT_TOKENS_WEEKLY;
    origWindow = process.env.SESSION_WINDOW_HOURS;
    origPeak = process.env.SESSION_BILLING_PEAK_MULTIPLIER;
    delete process.env.SESSION_PLAN;
    delete process.env.SESSION_LIMIT_TOKENS;
    delete process.env.SESSION_LIMIT_TOKENS_WEEKLY;
    delete process.env.SESSION_WINDOW_HOURS;
    delete process.env.SESSION_BILLING_PEAK_MULTIPLIER;
  });

  afterEach(() => {
    const restore = (k: string, v: string | undefined) =>
      v === undefined ? delete process.env[k] : (process.env[k] = v);
    restore('SESSION_PLAN', origPlan);
    restore('SESSION_LIMIT_TOKENS', origSession);
    restore('SESSION_LIMIT_TOKENS_WEEKLY', origWeekly);
    restore('SESSION_WINDOW_HOURS', origWindow);
    restore('SESSION_BILLING_PEAK_MULTIPLIER', origPeak);
  });

  it('SESSION_PLAN=pro applies all pro preset values', () => {
    process.env.SESSION_PLAN = 'pro';
    expect(SESSION_LIMIT()).toBe(44_000);
    expect(WEEKLY_LIMIT()).toBe(350_000);
    expect(SESSION_WINDOW_HOURS()).toBe(5);
    expect(PEAK_MULTIPLIER()).toBe(1.5);
  });

  it('explicit env var overrides the plan preset', () => {
    process.env.SESSION_PLAN = 'pro';
    process.env.SESSION_LIMIT_TOKENS = '60000';
    expect(SESSION_LIMIT()).toBe(60_000);
    expect(WEEKLY_LIMIT()).toBe(350_000); // still from plan
  });

  it('unknown plan falls back to hardcoded defaults', () => {
    process.env.SESSION_PLAN = 'unknown';
    expect(SESSION_LIMIT()).toBe(200_000);
    expect(WEEKLY_LIMIT()).toBe(1_000_000);
  });
});

// --------------- computeWeekBoundaries ---------------

describe('computeWeekBoundaries', () => {
  afterEach(() => vi.useRealTimers());

  it('windowStart is last Sunday 00:00 UTC when no timezone given', () => {
    // Wednesday 2025-01-15 12:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    const { windowStart, resetsAt } = computeWeekBoundaries();
    expect(windowStart.toISOString()).toBe('2025-01-12T00:00:00.000Z'); // last Sunday UTC
    expect(resetsAt.toISOString()).toBe('2025-01-19T00:00:00.000Z'); // next Sunday UTC
  });

  it('windowStart is last Sunday 00:00 in America/Sao_Paulo (UTC-3)', () => {
    // Wednesday 2025-01-15 01:00 UTC = Tuesday 2025-01-14 22:00 BRT
    // Last Sunday in BRT = 2025-01-12 00:00 BRT = 2025-01-12 03:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T01:00:00Z'));
    const { windowStart, resetsAt } = computeWeekBoundaries('America/Sao_Paulo');
    expect(windowStart.toISOString()).toBe('2025-01-12T03:00:00.000Z');
    expect(resetsAt.toISOString()).toBe('2025-01-19T03:00:00.000Z');
  });

  it('windowStart is last Sunday 00:00 in Asia/Tokyo (UTC+9)', () => {
    // Wednesday 2025-01-15 12:00 UTC = Wednesday 2025-01-15 21:00 JST
    // Last Sunday in JST = 2025-01-12 00:00 JST = 2025-01-11 15:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
    const { windowStart, resetsAt } = computeWeekBoundaries('Asia/Tokyo');
    expect(windowStart.toISOString()).toBe('2025-01-11T15:00:00.000Z');
    expect(resetsAt.toISOString()).toBe('2025-01-18T15:00:00.000Z');
  });

  it('when today is Sunday, windowStart is today 00:00 in that timezone', () => {
    // Sunday 2025-01-12 10:00 UTC = Sunday 2025-01-12 07:00 BRT
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-12T10:00:00Z'));
    const { windowStart } = computeWeekBoundaries('America/Sao_Paulo');
    expect(windowStart.toISOString()).toBe('2025-01-12T03:00:00.000Z');
  });
});

// --------------- PEAK_MULTIPLIER default ---------------

describe('PEAK_MULTIPLIER default', () => {
  let orig: string | undefined;

  beforeEach(() => {
    orig = process.env.SESSION_BILLING_PEAK_MULTIPLIER;
    delete process.env.SESSION_BILLING_PEAK_MULTIPLIER;
  });

  afterEach(() => {
    if (orig === undefined) delete process.env.SESSION_BILLING_PEAK_MULTIPLIER;
    else process.env.SESSION_BILLING_PEAK_MULTIPLIER = orig;
  });

  it('defaults to 1.5 when env var is unset', () => {
    expect(PEAK_MULTIPLIER()).toBe(1.5);
  });

  it('supports decimal values from env var', () => {
    process.env.SESSION_BILLING_PEAK_MULTIPLIER = '1.8';
    expect(PEAK_MULTIPLIER()).toBe(1.8);
  });
});

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
    expect(peakMultiplier(date)).toBe(PEAK_MULTIPLIER());
  });

  it('returns multiplier at exactly 05:00 PT (peak boundary — inclusive)', () => {
    // Jan 15 2025 13:00 UTC = Jan 15 05:00 PT (PST)
    const date = new Date('2025-01-15T13:00:00Z');
    expect(peakMultiplier(date)).toBe(PEAK_MULTIPLIER());
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
    expect(peakMultiplier(date)).toBe(PEAK_MULTIPLIER());
  });

  it('fall-back 2024-11-03 ambiguous hour at 10:30 PT — still peak', () => {
    // Nov 3 18:30 UTC = 10:30 PST (after fall-back) — still before 11, peak
    const date = new Date('2024-11-03T18:30:00Z');
    expect(peakMultiplier(date)).toBe(PEAK_MULTIPLIER());
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
    const peakMult = PEAK_MULTIPLIER();

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

  it('throws when session used === limit (block at boundary)', async () => {
    await expect(
      assertBudget('user', {
        session: { used: 1000, limit: 1000, resetsAt: null, isPeak: false },
        weekly: { used: 0, limit: 5000, resetsAt: new Date() },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws when weekly used === limit (block at boundary)', async () => {
    await expect(
      assertBudget('user', {
        session: { used: 0, limit: 1000, resetsAt: null, isPeak: false },
        weekly: { used: 5000, limit: 5000, resetsAt: new Date() },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws when session used > limit', async () => {
    await expect(
      assertBudget('user', {
        session: { used: 1001, limit: 1000, resetsAt: new Date(), isPeak: false },
        weekly: { used: 0, limit: 5000, resetsAt: new Date() },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws when weekly used > limit', async () => {
    await expect(
      assertBudget('user', {
        session: { used: 0, limit: 1000, resetsAt: null, isPeak: false },
        weekly: { used: 5001, limit: 5000, resetsAt: new Date() },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
