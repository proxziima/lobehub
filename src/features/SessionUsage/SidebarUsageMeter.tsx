'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import BudgetProgressBar from './BudgetProgressBar';
import { useBudget } from './useBudget';

const SidebarUsageMeter = memo(() => {
  const { t } = useTranslation('subscription');
  const { data } = useBudget();

  if (!data) return null;

  const { session, weekly } = data;
  const sessionPct = session.used / session.limit;
  const weeklyPct = weekly.used / weekly.limit;

  // Only show when either window is >= 80% used
  if (sessionPct < 0.8 && weeklyPct < 0.8) return null;

  return (
    <Flexbox
      gap={8}
      padding="8px 12px"
      style={{ borderTop: '1px solid var(--ant-color-split)' }}
      width="100%"
    >
      {sessionPct >= 0.8 && (
        <BudgetProgressBar
          label={t('sessionBilling.sessionWindow')}
          limit={session.limit}
          resetsAt={session.resetsAt}
          used={session.used}
        />
      )}
      {weeklyPct >= 0.8 && (
        <BudgetProgressBar
          label={t('sessionBilling.weeklyWindow')}
          limit={weekly.limit}
          resetsAt={weekly.resetsAt}
          used={weekly.used}
        />
      )}
    </Flexbox>
  );
});

SidebarUsageMeter.displayName = 'SidebarUsageMeter';

export default SidebarUsageMeter;
