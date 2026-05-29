'use client';

import { Alert, Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useBudget } from './useBudget';
import { formatTimeLeft, getThreshold } from './utils';

const ChatUsageBanner = memo(() => {
  const { t } = useTranslation('subscription');
  const { data: budget } = useBudget();

  if (!budget) return null;

  const { session, weekly } = budget;
  const sessionPct = Math.min(100, Math.round((session.used / session.limit) * 100));
  const weeklyPct = Math.min(100, Math.round((weekly.used / weekly.limit) * 100));

  // Session hard limit exceeded
  if (session.used >= session.limit) {
    const timeLeft = formatTimeLeft(session.resetsAt);
    return (
      <Flexbox padding="12px 0 8px">
        <Alert
          showIcon
          message={t('sessionBilling.limitReached')}
          type="warning"
          description={
            timeLeft
              ? t('sessionBilling.resetsIn', { time: timeLeft })
              : t('sessionBilling.limitReachedDesc')
          }
        />
      </Flexbox>
    );
  }

  // Weekly hard limit exceeded
  if (weekly.used >= weekly.limit) {
    return (
      <Flexbox padding="12px 0 8px">
        <Alert
          showIcon
          description={t('sessionBilling.weeklyLimitReachedDesc')}
          message={t('sessionBilling.weeklyLimitReached')}
          type="warning"
        />
      </Flexbox>
    );
  }

  const sessionThreshold = getThreshold(sessionPct);
  const weeklyThreshold = getThreshold(weeklyPct);

  // Session approaching limit (90%+)
  if (sessionThreshold === 'danger') {
    const timeLeft = formatTimeLeft(session.resetsAt);
    return (
      <Flexbox padding="12px 0 8px">
        <Alert
          showIcon
          message={t('sessionBilling.approachingLimit', { pct: sessionPct })}
          type="warning"
          description={
            timeLeft
              ? t('sessionBilling.approachingLimitDesc', { time: timeLeft })
              : t('sessionBilling.limitReachedDesc')
          }
        />
      </Flexbox>
    );
  }

  // Weekly approaching limit (90%+)
  if (weeklyThreshold === 'danger') {
    return (
      <Flexbox padding="12px 0 8px">
        <Alert
          showIcon
          description={t('sessionBilling.approachingWeeklyLimitDesc')}
          message={t('sessionBilling.approachingWeeklyLimit', { pct: weeklyPct })}
          type="warning"
        />
      </Flexbox>
    );
  }

  // Session soft warning (70%+)
  if (sessionThreshold === 'warn') {
    const timeLeft = formatTimeLeft(session.resetsAt);
    return (
      <Flexbox padding="12px 0 8px">
        <Alert
          showIcon
          message={t('sessionBilling.approachingLimit', { pct: sessionPct })}
          type="info"
          description={
            timeLeft
              ? t('sessionBilling.approachingLimitDesc', { time: timeLeft })
              : t('sessionBilling.limitReachedDesc')
          }
        />
      </Flexbox>
    );
  }

  // Weekly soft warning (70%+)
  if (weeklyThreshold === 'warn') {
    return (
      <Flexbox padding="12px 0 8px">
        <Alert
          showIcon
          description={t('sessionBilling.approachingWeeklyLimitDesc')}
          message={t('sessionBilling.approachingWeeklyLimit', { pct: weeklyPct })}
          type="info"
        />
      </Flexbox>
    );
  }

  return null;
});

ChatUsageBanner.displayName = 'ChatUsageBanner';

export default ChatUsageBanner;
