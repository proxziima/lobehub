'use client';

import { Progress } from 'antd';
import { cx, useTheme } from 'antd-style';
import { Calendar, ChevronDown, Clock } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { BudgetSnapshot } from '@/server/services/sessionBilling';

import { formatTimeLeft, getThreshold } from '../utils';
import { styles } from './styles';
import WeeklyBarChart from './WeeklyBarChart';

interface UsageMeterCardProps {
  data: BudgetSnapshot;
}

const UsageMeterCard = memo<UsageMeterCardProps>(({ data }) => {
  const { t } = useTranslation('subscription');
  const token = useTheme();
  const [isWeeklyExpanded, setIsWeeklyExpanded] = useState(false);

  const { session, weekly } = data;

  const sessionPct = Math.min(100, Math.round((session.used / session.limit) * 100));
  const weeklyPct = Math.min(100, Math.round((weekly.used / weekly.limit) * 100));

  const resolveColor = (pct: number) => {
    const t = getThreshold(pct);
    if (t === 'danger') return token.colorError;
    if (t === 'warn') return token.colorWarning;
    return token.colorSuccess;
  };

  const sessionColor = resolveColor(sessionPct);
  const weeklyColor = resolveColor(weeklyPct);
  const sessionTimeLeft = formatTimeLeft(session.resetsAt);

  return (
    <div className={styles.card}>
      <div className={styles.title}>{t('sessionBilling.cardTitle')}</div>
      <div className={styles.subtitle}>{t('sessionBilling.cardSubtitle')}</div>

      {/* Current Session */}
      <div className={styles.section}>
        <div className={styles.metricRow}>
          <div className={styles.metricLabel}>
            <span className={styles.iconWrap}>
              <Clock size={14} />
            </span>
            {t('sessionBilling.currentSession')}
          </div>
          <span className={styles.percentText} style={{ color: sessionColor }}>
            {sessionPct}%
          </span>
        </div>
        <div className={styles.progressWrap}>
          <Progress
            percent={sessionPct}
            showInfo={false}
            strokeColor={sessionColor}
            strokeWidth={10}
            style={{ margin: 0 }}
            trailColor={token.colorFillSecondary}
          />
        </div>
        {sessionTimeLeft && (
          <div style={{ color: token.colorTextDescription, fontSize: 11, marginTop: 4 }}>
            {t('sessionBilling.resetsIn', { time: sessionTimeLeft })}
          </div>
        )}
      </div>

      {/* Weekly Overview */}
      <div className={styles.section}>
        <div className={styles.metricRow}>
          <div className={styles.metricLabel}>
            <span className={styles.iconWrap}>
              <Calendar size={14} />
            </span>
            {t('sessionBilling.weeklyOverview')}
            <button
              aria-label={isWeeklyExpanded ? 'Collapse' : 'Expand'}
              className={styles.chevronBtn}
              onClick={() => setIsWeeklyExpanded((v) => !v)}
            >
              <ChevronDown
                className={cx(isWeeklyExpanded ? styles.chevronRotated : styles.chevronDefault)}
                size={16}
              />
            </button>
          </div>
          <span className={styles.percentText} style={{ color: weeklyColor }}>
            {weeklyPct}%
          </span>
        </div>

        {isWeeklyExpanded ? (
          <WeeklyBarChart data={weekly.dailyBreakdown} sessionLimit={session.limit} />
        ) : (
          <div className={styles.progressWrap}>
            <Progress
              percent={weeklyPct}
              showInfo={false}
              strokeColor={weeklyColor}
              strokeWidth={10}
              style={{ margin: 0 }}
              trailColor={token.colorFillSecondary}
            />
          </div>
        )}
      </div>
    </div>
  );
});

UsageMeterCard.displayName = 'UsageMeterCard';

export default UsageMeterCard;
