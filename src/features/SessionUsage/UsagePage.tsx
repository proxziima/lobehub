'use client';

import { Flexbox } from '@lobehub/ui';
import { Skeleton } from 'antd';
import { memo } from 'react';

import BudgetProgressBar from './BudgetProgressBar';
import { useBudget } from './useBudget';

const UsagePage = memo(() => {
  const { data, isLoading } = useBudget();

  if (isLoading) return <Skeleton active paragraph={{ rows: 2 }} />;
  if (!data) return null;

  const { session, weekly } = data;

  return (
    <Flexbox gap={16} padding="0 16px 24px">
      <BudgetProgressBar
        label="Current session"
        limit={session.limit}
        resetsAt={session.resetsAt}
        used={session.used}
      />
      <BudgetProgressBar
        label="Weekly usage"
        limit={weekly.limit}
        resetsAt={weekly.resetsAt}
        used={weekly.used}
      />
    </Flexbox>
  );
});

UsagePage.displayName = 'UsagePage';

export default UsagePage;
