import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};
    background: color-mix(in srgb, ${cssVar.colorBgContainer} 70%, black);
  `,

  title: css`
    font-size: ${cssVar.fontSizeLG};
    font-weight: 600;
    line-height: 1.3;
    color: ${cssVar.colorText};
  `,

  subtitle: css`
    margin-block: 2px 12px;
    font-size: ${cssVar.fontSizeSM};
    color: ${cssVar.colorTextDescription};
  `,

  section: css`
    & + & {
      margin-block-start: 16px;
    }
  `,

  metricRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-block-end: 8px;
  `,

  metricLabel: css`
    display: flex;
    gap: 6px;
    align-items: center;

    font-size: ${cssVar.fontSizeSM};
    font-weight: 500;
    color: ${cssVar.colorText};
  `,

  iconWrap: css`
    display: flex;
    align-items: center;
    color: ${cssVar.colorTextDescription};
  `,

  percentText: css`
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  `,

  weeklyRightGroup: css`
    display: flex;
    gap: 8px;
    align-items: center;
  `,

  chevronBtn: css`
    cursor: pointer;

    display: flex;
    align-items: center;

    padding: 2px;
    border: none;

    color: ${cssVar.colorTextDescription};

    background: transparent;

    transition: opacity 0.15s ease;

    &:hover {
      opacity: 0.7;
    }
  `,

  chevronRotated: css`
    transform: rotate(180deg);
    transition: transform 0.3s ease;
  `,

  chevronDefault: css`
    transform: rotate(0deg);
    transition: transform 0.3s ease;
  `,

  progressWrap: css`
    .ant-progress-inner {
      background-color: ${cssVar.colorFillSecondary};
    }
  `,

  barChart: css`
    display: flex;
    gap: 6px;
    align-items: flex-end;

    height: 80px;
    margin-block-start: 8px;
    padding-inline: 2px;
  `,

  barWrap: css`
    cursor: pointer;

    position: relative;

    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;

    height: 100%;
  `,

  bar: css`
    transform-origin: bottom;
    width: 100%;
    border-radius: 4px;
    transition:
      transform 0.25s ease,
      opacity 0.25s ease;
  `,

  barLabel: css`
    margin-block-start: 4px;

    font-size: 10px;
    font-weight: 500;
    color: ${cssVar.colorTextDescription};

    transition: color 0.2s ease;
  `,

  barLabelActive: css`
    color: ${cssVar.colorText};
  `,

  tooltip: css`
    pointer-events: none;

    position: absolute;
    inset-block-start: -28px;
    inset-inline-start: 50%;
    transform: translateX(-50%) translateY(4px);

    padding-block: 2px;
    padding-inline: 8px;
    border-radius: 6px;

    font-size: 11px;
    font-weight: 500;
    color: ${cssVar.colorBgContainer};
    white-space: nowrap;

    background: ${cssVar.colorText};

    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  `,

  tooltipVisible: css`
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  `,

  tooltipHidden: css`
    opacity: 0;
  `,

  footer: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;

    margin-block-start: 12px;
    padding-block-start: 12px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,

  footerLabel: css`
    margin-block-end: 2px;
    font-size: ${cssVar.fontSizeSM};
    color: ${cssVar.colorTextDescription};
  `,

  footerValue: css`
    font-size: 16px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorText};
  `,
}));
