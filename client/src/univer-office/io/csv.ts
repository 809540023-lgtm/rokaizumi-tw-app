/**
 * CSV 讀寫（純函式，可單獨測試）
 */

import { escapeCsvCell } from '../cell-utils';

export function matrixToCsv(matrix: Array<Array<unknown>>, delimiter = ','): string {
  return matrix.map((row) => row.map(escapeCsvCell).join(delimiter)).join('\r\n');
}

/**
 * 解析 CSV。支援：
 *  - 雙引號包覆、欄位內逗號與換行、"" 逸出
 *  - CRLF / LF
 *  - 自動去除 UTF-8 BOM（Excel 匯出的檔案幾乎都有）
 */
export function csvToMatrix(text: string, delimiter = ','): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      // 由 \n 統一處理換列
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // 去掉結尾多出來的空列
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === '')) rows.pop();
  return rows;
}

/** 猜分隔符：有 TAB 就用 TAB，否則逗號（Excel 另存 UTF-16 TSV 時常用） */
export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/)[0] ?? '';
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

/** 把 CSV 文字轉成可寫入試算表的二維陣列（數字自動轉型） */
export function csvTextToValues(text: string): Array<Array<string | number>> {
  const matrix = csvToMatrix(text, detectDelimiter(text));
  return matrix.map((row) =>
    row.map((cell) => {
      const trimmed = cell.trim();
      if (trimmed === '') return '';
      // 保留前導 0（例如 0012 這種料號）與電話號碼，不要轉成數字
      if (/^0\d+$/.test(trimmed)) return cell;
      if (/^-?\d+(\.\d+)?$/.test(trimmed) && trimmed.length <= 15) return Number(trimmed);
      return cell;
    }),
  );
}
