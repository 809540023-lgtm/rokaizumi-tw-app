/**
 * 試算表座標工具（0-based 索引 <-> A1 表示法）
 */

export function columnIndexToLetter(index: number): string {
  let n = index;
  let letters = '';
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letters;
}

export function letterToColumnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** (row, col) 都用 0-based，回傳 A1 這種表示法 */
export function toA1(row: number, col: number): string {
  return `${columnIndexToLetter(col)}${row + 1}`;
}

export function toRange(row: number, col: number, rowCount = 1, colCount = 1): string {
  const start = toA1(row, col);
  const end = toA1(row + rowCount - 1, col + colCount - 1);
  return start === end ? start : `${start}:${end}`;
}

/** 'A1:B3' -> { startRow, startCol, endRow, endCol }（皆 0-based，含端點） */
export function parseRange(ref: string): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
  const m = /^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/.exec(ref.trim());
  if (!m) return null;
  const startCol = letterToColumnIndex(m[1]);
  const startRow = Number(m[2]) - 1;
  const endCol = m[3] ? letterToColumnIndex(m[3]) : startCol;
  const endRow = m[4] ? Number(m[4]) - 1 : startRow;
  return {
    startRow: Math.min(startRow, endRow),
    endRow: Math.max(startRow, endRow),
    startCol: Math.min(startCol, endCol),
    endCol: Math.max(startCol, endCol),
  };
}

/** 把 2D 矩陣轉成 CSV 用的字串（處理引號、逗號、換行） */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
