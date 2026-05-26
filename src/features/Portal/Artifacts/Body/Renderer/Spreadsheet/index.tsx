import '@univerjs/preset-sheets-core/lib/index.css';

import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { createUniver, LocaleType } from '@univerjs/presets';
import { memo, useEffect, useRef } from 'react';

interface Props {
  csv: string;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell !== ''));
}

function csvToWorkbookData(csv: string) {
  const rows = parseCSV(csv);
  const sheetId = 'sheet-1';
  const cellData: Record<number, Record<number, { v: string }>> = {};

  for (let r = 0; r < rows.length; r++) {
    cellData[r] = {};
    for (let c = 0; c < rows[r].length; c++) {
      cellData[r][c] = { v: rows[r][c] };
    }
  }

  return {
    appVersion: '0.24.0',
    id: 'spreadsheet-artifact',
    locale: LocaleType.EN_US,
    name: 'Sheet',
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        cellData,
        columnCount: Math.max(rows[0]?.length ?? 1, 1),
        id: sheetId,
        name: 'Sheet1',
        rowCount: Math.max(rows.length, 1),
      },
    },
    styles: {},
  };
}

const SpreadsheetRenderer = memo<Props>(({ csv }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const { univerAPI } = createUniver({
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
          footer: false,
          formulaBar: false,
          toolbar: false,
        }),
      ],
    });

    const workbook = univerAPI.createWorkbook(csvToWorkbookData(csv));
    workbook.setEditable(false);
    const unitId = workbook.getId();

    return () => {
      univerAPI.disposeUnit(unitId);
    };
  }, [csv]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
});

export default SpreadsheetRenderer;
