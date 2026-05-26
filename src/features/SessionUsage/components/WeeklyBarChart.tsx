'use client';

import { cx, useTheme } from 'antd-style';
import { memo, useState } from 'react';

import { getThreshold } from '../utils';
import { styles } from './styles';

interface WeeklyBarChartProps {
  data: Array<{ weekday: string; tokens: number }>;
  sessionLimit: number;
}

const WeeklyBarChart = memo<WeeklyBarChartProps>(({ data, sessionLimit }) => {
  const token = useTheme();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxTokens = Math.max(...data.map((d) => d.tokens), 1);

  const thresholdColor = (pct: number) => {
    const t = getThreshold(pct);
    if (t === 'danger') return token.colorError;
    if (t === 'warn') return token.colorWarning;
    return token.colorSuccess;
  };

  return (
    <div className={styles.barChart} onMouseLeave={() => setHoveredIndex(null)}>
      {data.map((item, index) => {
        const heightPct = (item.tokens / maxTokens) * 100;
        const pct = Math.min(100, Math.round((item.tokens / sessionLimit) * 100));
        const color = thresholdColor(pct);
        const isHovered = hoveredIndex === index;
        const isNeighbor = hoveredIndex !== null && Math.abs(index - hoveredIndex) === 1;
        const isAnyHovered = hoveredIndex !== null;

        const opacity = isHovered ? 1 : isNeighbor ? 0.5 : isAnyHovered ? 0.2 : 0.3;
        const scaleX = isHovered ? 1.15 : isNeighbor ? 1.05 : 1;

        return (
          <div
            className={styles.barWrap}
            key={item.weekday}
            onMouseEnter={() => setHoveredIndex(index)}
          >
            <div
              className={cx(
                styles.tooltip,
                isHovered ? styles.tooltipVisible : styles.tooltipHidden,
              )}
            >
              {pct}%
            </div>

            <div
              className={styles.bar}
              style={{
                background: color,
                height: `${heightPct}%`,
                minHeight: 2,
                opacity,
                transform: `scaleX(${scaleX})`,
              }}
            />

            <span className={cx(styles.barLabel, isHovered && styles.barLabelActive)}>
              {item.weekday}
            </span>
          </div>
        );
      })}
    </div>
  );
});

WeeklyBarChart.displayName = 'WeeklyBarChart';

export default WeeklyBarChart;
