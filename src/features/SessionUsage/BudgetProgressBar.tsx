'use client';

import { Flexbox } from '@lobehub/ui';
import { Progress, Typography } from 'antd';
import { memo } from 'react';

interface BudgetProgressBarProps {
  label: string;
  limit: number;
  resetsAt: Date | null;
  used: number;
}

const formatTimeLeft = (resetsAt: Date | null): string => {
  if (!resetsAt) return '';
  const ms = resetsAt.getTime() - Date.now();
  if (ms <= 0) return 'Resetting…';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min`;
};

const BudgetProgressBar = memo<BudgetProgressBarProps>(({ label, used, limit, resetsAt }) => {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const status = pct >= 100 ? 'exception' : 'normal';
  const timeLeft = formatTimeLeft(resetsAt);

  return (
    <Flexbox horizontal align="center" gap={12} width="100%">
      <Flexbox gap={2} style={{ minWidth: 140 }}>
        <Typography.Text strong style={{ fontSize: 13 }}>
          {label}
        </Typography.Text>
        {timeLeft && (
          <Typography.Text style={{ fontSize: 12 }} type="secondary">
            Resets in {timeLeft}
          </Typography.Text>
        )}
      </Flexbox>
      <Flexbox flex={1}>
        <Progress
          percent={pct}
          showInfo={false}
          size="small"
          status={status}
          strokeColor={pct >= 100 ? '#ff4d4f' : '#1677ff'}
          style={{ margin: 0 }}
        />
      </Flexbox>
      <Typography.Text style={{ fontSize: 12, minWidth: 52, textAlign: 'right' }} type="secondary">
        {pct}% used
      </Typography.Text>
    </Flexbox>
  );
});

BudgetProgressBar.displayName = 'BudgetProgressBar';

export default BudgetProgressBar;
