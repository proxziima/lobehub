'use client';

import { Skeleton } from 'antd';
import { memo } from 'react';

import UsageMeterCard from './components/UsageMeterCard';
import { useBudget } from './useBudget';

const UsagePage = memo(() => {
  const { data, isLoading } = useBudget();

  if (isLoading) return <Skeleton active paragraph={{ rows: 3 }} style={{ padding: '0 16px' }} />;
  if (!data) return null;

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <UsageMeterCard data={data} />
    </div>
  );
});

UsagePage.displayName = 'UsagePage';

export default UsagePage;
