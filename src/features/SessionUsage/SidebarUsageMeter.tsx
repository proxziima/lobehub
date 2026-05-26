'use client';

import { memo } from 'react';

import UsageMeterCard from './components/UsageMeterCard';
import { useBudget } from './useBudget';

const SidebarUsageMeter = memo(() => {
  const { data } = useBudget();

  if (!data) return null;

  return (
    <div style={{ borderTop: '1px solid var(--ant-color-split)', padding: 12 }}>
      <UsageMeterCard data={data} />
    </div>
  );
});

SidebarUsageMeter.displayName = 'SidebarUsageMeter';

export default SidebarUsageMeter;
