export const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

export type Threshold = 'ok' | 'warn' | 'danger';

export const getThreshold = (pct: number): Threshold => {
  if (pct >= 90) return 'danger';
  if (pct >= 70) return 'warn';
  return 'ok';
};

export const formatTimeLeft = (resetsAt: Date | null): string => {
  if (!resetsAt) return '';
  const ms = resetsAt.getTime() - Date.now();
  if (ms <= 0) return 'Resetting…';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};
