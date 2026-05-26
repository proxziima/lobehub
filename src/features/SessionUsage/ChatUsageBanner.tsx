'use client';

import { Alert, Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface ChatUsageBannerProps {
  limit: number;
  resetsAt: Date | null;
  used: number;
}

const formatTimeLeft = (resetsAt: Date | null): string => {
  if (!resetsAt) return '';
  const ms = resetsAt.getTime() - Date.now();
  if (ms <= 0) return '';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const ChatUsageBanner = memo<ChatUsageBannerProps>(({ resetsAt }) => {
  const { t } = useTranslation('subscription');
  const timeLeft = formatTimeLeft(resetsAt);

  return (
    <Flexbox padding="8px 0">
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
});

ChatUsageBanner.displayName = 'ChatUsageBanner';

export default ChatUsageBanner;
