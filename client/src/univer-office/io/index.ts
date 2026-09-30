/**
 * 匯入 / 匯出：把 Univer 的內容與外部檔案格式接起來。
 *
 * 這裡是 Facade API 與檔案格式之間的唯一黏著層，
 * UI 只呼叫這些函式，不直接碰 Univer 內部結構。
 */

import { toRange } from '../cell-utils';
import { csvTextToValues, matrixToCsv } from './csv';
import { downloadBlob, pickFile, readFileAsText, sanitizeFilename, timestampSuffix } from './download';
import { matrixToXlsxBlob, xlsxFileToSheets, type XlsxSheetData } from './xlsx';
import { paragraphsToDocxBlob, type DocxParagraphInput } from './docx-export';
import { parseDocxParagraphs } from './docx-import';

export * from './csv';
export * from './xlsx';
export * from './download';
export * from './docx-export';
export * from './docx-import';

/** 讀出工作表的內容（去除尾端空白列 / 欄） */
export function readSheetMatrix(sheet: any): Array<Array<string | number | null>> {
  if (typeof sheet?.getDataRange !== 'function') {
    // 這個錯誤訊息是刻意的：很容易不小心把 FWorkbook 當成 FWorksheet 傳進來，
    // 那樣 getDataRange 會是 undefined，最後只會得到「沒有內容可以匯出」這種誤導的訊息。
    if (typeof sheet?.getActiveSheet === 'function') {
      throw new Error('readSheetMatrix 需要「工作表」物件，但你傳入了「活頁簿」；請改用 workbook.getActiveSheet()');
    }
    throw new Error('readSheetMatrix 需要工作表物件（FWorksheet）');
  }
  const range = sheet.getDataRange();
  if (!range) return [];
  const values = (range.getValues?.() ?? []) as Array<Array<string | number | null>>;
  return trimMatrix(values);
}

export function trimMatrix(matrix: Array<Array<unknown>>): Array<Array<string | number | null>> {
  const cleaned = matrix.map((row) => row.map((cell) => (cell === undefined ? null : (cell as string | number | null))));

  while (cleaned.length > 0 && cleaned[cleaned.length - 1].every((c) => c === null || c === '')) cleaned.pop();

  let lastCol = -1;
  for (const row of cleaned) {
    row.forEach((cell, i) => {
      if (cell !== null && cell !== '') lastCol = Math.max(lastCol, i);
    });
  }
  if (lastCol < 0) return cleaned.map(() => []);
  return cleaned.map((row) => row.slice(0, lastCol + 1));
}

/** 把二維矩陣寫進工作表（從指定位置開始） */
export function writeMatrixToSheet(
  sheet: any,
  matrix: Array<Array<string | number | boolean | null>>,
  startRow = 0,
  startCol = 0,
): number {
  if (matrix.length === 0) return 0;
  const maxCols = matrix.reduce((m, r) => Math.max(m, r.length), 0);

  const currentCols = sheet.getMaxColumns?.() ?? 0;
  if (currentCols < startCol + maxCols) sheet.setColumnCount?.(startCol + maxCols + 4);

  const padded = matrix.map((row) => {
    const out = row.slice();
    while (out.length < maxCols) out.push(null);
    return out;
  });

  sheet.getRange(toRange(startRow, startCol, padded.length, maxCols)).setValues(padded);
  return padded.length;
}

/* ------------------------------------------------------------------ */
/* 工作表匯出                                                          */
/* ------------------------------------------------------------------ */

export function exportSheetAsCsv(sheet: any, title: string): void {
  const matrix = readSheetMatrix(sheet);
  if (matrix.length === 0) throw new Error('這張工作表沒有內容可以匯出');
  const csv = matrixToCsv(matrix);
  // 加 BOM，Excel 開啟中文才不會亂碼
  downloadBlob(
    new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    `${sanitizeFilename(title)}-${timestampSuffix()}.csv`,
  );
}

export async function exportSheetAsXlsx(sheet: any, title: string): Promise<void> {
  const matrix = readSheetMatrix(sheet);
  if (matrix.length === 0) throw new Error('這張工作表沒有內容可以匯出');
  const blob = await matrixToXlsxBlob(matrix, sheet.getSheetName?.() ?? 'Sheet1');
  downloadBlob(blob, `${sanitizeFilename(title)}-${timestampSuffix()}.xlsx`);
}

/* ------------------------------------------------------------------ */
/* 工作表匯入                                                          */
/* ------------------------------------------------------------------ */

export async function importCsvIntoSheet(sheet: any): Promise<{ rows: number; source: string } | null> {
  const [file] = await pickFile('.csv,.txt,text/csv');
  if (!file) return null;
  const text = await readFileAsText(file);
  const values = csvTextToValues(text);
  const rows = writeMatrixToSheet(sheet, values, 0, 0);
  return { rows, source: file.name };
}

export async function importXlsxIntoWorkbook(
  workbook: any,
  options: { replaceActiveSheet?: boolean } = {},
): Promise<{ sheets: string[]; totalRows: number; source: string } | null> {
  const [file] = await pickFile('.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  if (!file) return null;

  const parsed: XlsxSheetData[] = await xlsxFileToSheets(file);
  if (parsed.length === 0) throw new Error('這個 Excel 檔沒有任何工作表');

  const created: string[] = [];
  let totalRows = 0;
  let first = true;

  for (const { name, rows } of parsed) {
    if (rows.length === 0) continue;
    let sheet: any;
    if (first && options.replaceActiveSheet) {
      sheet = workbook.getActiveSheet();
      sheet?.setName?.(name);
    } else {
      sheet = workbook.insertSheet();
      sheet?.setName?.(name);
    }
    if (!sheet) continue;
    totalRows += writeMatrixToSheet(sheet, rows, 0, 0);
    created.push(sheet.getSheetName());
    first = false;
  }

  // 切到第一張匯入的工作表，讓使用者馬上看到結果
  if (created.length > 0) {
    try {
      workbook.getSheetByName(created[0])?.activate?.();
    } catch {
      /* 切換失敗不影響內容 */
    }
  }

  return { sheets: created, totalRows, source: file.name };
}

/* ------------------------------------------------------------------ */
/* 文檔匯出 / 匯入                                                     */
/* ------------------------------------------------------------------ */

export function readDocumentParagraphs(document: any): string[] {
  const paragraphs = document?.getParagraphs?.() ?? [];
  return paragraphs.map((p: any) => String(p?.getText?.() ?? ''));
}

export async function exportDocumentAsDocx(document: any, title: string): Promise<void> {
  const texts = readDocumentParagraphs(document);
  const paragraphs: DocxParagraphInput[] = texts.map((text) => ({ text }));
  const blob = await paragraphsToDocxBlob(paragraphs, { title });
  downloadBlob(blob, `${sanitizeFilename(title)}-${timestampSuffix()}.docx`);
}

export async function exportDocumentAsText(document: any, title: string): Promise<void> {
  const texts = readDocumentParagraphs(document);
  downloadBlob(
    new Blob([texts.join('\r\n')], { type: 'text/plain;charset=utf-8' }),
    `${sanitizeFilename(title)}-${timestampSuffix()}.txt`,
  );
}

export async function importDocxIntoDocument(
  document: any,
): Promise<{ paragraphs: number; source: string } | null> {
  const [file] = await pickFile('.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  if (!file) return null;

  const paragraphs = await parseDocxParagraphs(file);
  if (paragraphs.length === 0) throw new Error('這個 Word 檔沒有可匯入的文字內容');

  for (const text of paragraphs) document.appendParagraph(text);
  return { paragraphs: paragraphs.length, source: file.name };
}

/* ------------------------------------------------------------------ */
/* 快照（本系統主要的存檔格式）                                          */
/* ------------------------------------------------------------------ */

export function snapshotToJson(unit: any): unknown {
  const snapshot = unit?.save?.();
  if (!snapshot) throw new Error('無法取得內容快照');
  return snapshot;
}

export function exportSnapshotAsJson(unit: any, title: string): void {
  const json = JSON.stringify(snapshotToJson(unit), null, 2);
  downloadBlob(
    new Blob([json], { type: 'application/json' }),
    `${sanitizeFilename(title)}-${timestampSuffix()}.json`,
  );
}

/** 從 JSON 檔還原快照（用於備份還原或跨環境搬移） */
export async function importSnapshotFromFile(): Promise<{ snapshot: unknown; source: string } | null> {
  const [file] = await pickFile('.json,application/json');
  if (!file) return null;
  const text = await readFileAsText(file);
  const snapshot = JSON.parse(text);
  return { snapshot, source: file.name };
}

/** 估算快照大小（讓 UI 顯示「這份文件多大」） */
export function snapshotSize(snapshot: unknown): number {
  try {
    return new Blob([JSON.stringify(snapshot)]).size;
  } catch {
    return 0;
  }
}
