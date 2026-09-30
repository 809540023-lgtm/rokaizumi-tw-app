/**
 * 範本套用。
 *
 * 把範本描述轉成 Univer Facade API 呼叫：
 *   建立單位 → 寫入值 → 寫入公式 → 套用樣式 → 合併儲存格 → 欄寬列高 → 凍結窗格
 *
 * 順序有講究：先寫值再寫公式，最後才合併，
 * 否則合併會把剛寫進去的值蓋掉。
 */

import { BorderStyleTypes, BorderType } from '@univerjs/presets';
import { toRange, columnIndexToLetter } from '../cell-utils';
import { DOC_TEMPLATES, findDocTemplate } from './doc-templates';
import { SHEET_TEMPLATES, findSheetTemplate } from './sheet-templates';
import type {
  CellSpec,
  DocTemplateDefinition,
  RangeStyle,
  SheetTemplateDefinition,
  SheetTemplateLayout,
  TemplateContext,
} from '../types';

/** 只用到 Univer Facade API 的一小部分，用結構化型別避免版本間的型別摩擦 */
export interface FacadeLike {
  createWorkbook(data?: unknown, options?: unknown): any;
  createDocument(data?: unknown, options?: unknown): any;
  getActiveWorkbook(): any;
  getActiveDocument(): any;
  disposeUnit(id: string): boolean;
}

const isCellSpec = (c: unknown): c is CellSpec =>
  typeof c === 'object' && c !== null && ('v' in (c as object) || 'f' in (c as object));

function normalizeRows(rows: SheetTemplateLayout['rows']): {
  values: Array<Array<string | number | boolean | null>>;
  formulas: Array<Array<string | null>>;
  width: number;
} {
  const width = rows.reduce((max, row) => Math.max(max, row?.length ?? 0), 1);
  const values: Array<Array<string | number | boolean | null>> = [];
  const formulas: Array<Array<string | null>> = [];

  for (const row of rows) {
    const valueRow: Array<string | number | boolean | null> = new Array(width).fill(null);
    const formulaRow: Array<string | null> = new Array(width).fill(null);
    if (row) {
      row.forEach((raw, col) => {
        if (raw === null || raw === undefined) return;
        if (isCellSpec(raw)) {
          if (raw.f !== undefined) {
            formulaRow[col] = raw.f.replace(/^=/, '');
          } else {
            valueRow[col] = raw.v ?? null;
          }
        } else {
          valueRow[col] = raw as string | number | boolean;
        }
      });
    }
    values.push(valueRow);
    formulas.push(formulaRow);
  }
  return { values, formulas, width };
}

function applyStyle(sheet: any, style: RangeStyle): void {
  const range = sheet.getRange(style.range);
  if (!range) return;

  if (style.bold) range.setFontWeight('bold');
  if (style.italic) range.setFontStyle('italic');
  if (style.fontSize) range.setFontSize(style.fontSize);
  if (style.fontColor) range.setFontColor(style.fontColor);
  if (style.background) range.setBackground(style.background);
  if (style.horizontalAlign) range.setHorizontalAlignment(style.horizontalAlign);
  if (style.verticalAlign) range.setVerticalAlignment(style.verticalAlign);
  if (style.wrap !== undefined) range.setWrap(style.wrap);
  if (style.numberFormat) {
    // setNumberFormat 由 @univerjs/sheets-numfmt 的 Facade 擴充提供
    range.setNumberFormat?.(style.numberFormat);
  }
  if (style.border && style.border !== 'none') {
    const map: Record<string, BorderType> = {
      all: BorderType.ALL,
      outside: BorderType.OUTSIDE,
      bottom: BorderType.BOTTOM,
    };
    range.setBorder(map[style.border] ?? BorderType.ALL, BorderStyleTypes.THIN, '#94A3B8');
  }
}

/** 把範本內容填進指定的工作表 */
export function fillSheet(sheet: any, template: SheetTemplateDefinition, context?: TemplateContext): void {
  const layout = template.build(context);
  const { values, formulas } = normalizeRows(layout.rows);

  values.forEach((row, r) => {
    if (row.every((v) => v === null)) return;
    sheet.getRange(toRange(r, 0, 1, row.length)).setValues([row]);
  });

  formulas.forEach((row, r) => {
    row.forEach((f, c) => {
      if (f) sheet.getRange(toRange(r, c)).setFormula(f);
    });
  });

  for (const style of layout.styles ?? []) {
    try {
      applyStyle(sheet, style);
    } catch {
      // 單一樣式失敗不應讓整個範本套用中止
    }
  }

  // 先寫值再合併，否則合併會蓋掉內容
  for (const ref of layout.merges ?? []) {
    try {
      sheet.getRange(ref).merge();
    } catch {
      // 合併衝突（例如已合併）略過
    }
  }

  for (const [col, width] of Object.entries(layout.columnWidths ?? {})) {
    sheet.setColumnWidth(Number(col), width);
  }
  for (const [row, height] of Object.entries(layout.rowHeights ?? {})) {
    sheet.setRowHeight(Number(row), height);
  }
  if (layout.freezeRows) sheet.setFrozenRows(layout.freezeRows);
}

/** 產生不重複的工作表名稱 */
function uniqueSheetName(workbook: any, desired: string): string {
  const taken = new Set((workbook.getSheets() ?? []).map((s: any) => s.getSheetName()));
  if (!taken.has(desired)) return desired;
  let n = 2;
  while (taken.has(`${desired} (${n})`)) n += 1;
  return `${desired} (${n})`;
}

/** 在目前作用中的 workbook「新增」一張套好範本的工作表（不動到既有分頁） */
export function insertSheetFromTemplate(
  api: FacadeLike,
  template: SheetTemplateDefinition,
  context?: TemplateContext,
): { sheetName: string; unitId: string } | null {
  const workbook = api.getActiveWorkbook();
  if (!workbook) return null;

  const desired = template.build(context).sheetName;
  const sheet = workbook.insertSheet();
  if (!sheet) return null;

  sheet.setName(uniqueSheetName(workbook, desired));
  fillSheet(sheet, template, context);

  // 一定要切換到新分頁：否則使用者接下來按「匯出」時，
  // 讀到的還是原來那張空白工作表，會得到「沒有內容可以匯出」。
  try {
    sheet.activate();
  } catch {
    /* 切換失敗不影響內容 */
  }

  return { sheetName: sheet.getSheetName(), unitId: workbook.getId() };
}

/** 用範本建立一份全新的試算表（新的 Univer 單位） */
export function createSheetFromTemplate(
  api: FacadeLike,
  template: SheetTemplateDefinition,
  context?: TemplateContext,
): { workbook: any; sheetName: string } | null {
  const workbook = api.createWorkbook({ name: template.name });
  if (!workbook) return null;

  const sheet = workbook.getActiveSheet();
  sheet?.setName(template.build(context).sheetName);
  if (sheet) fillSheet(sheet, template, context);

  return { workbook, sheetName: sheet?.getSheetName() ?? template.name };
}

/** 用範本建立一份新的文檔 */
export function createDocFromTemplate(
  api: FacadeLike,
  template: DocTemplateDefinition,
  context?: TemplateContext,
): { document: any; title: string } | null {
  const paragraphs = template.build(context);
  const document = api.createDocument({ title: template.name });
  if (!document) return null;

  paragraphs.forEach((text) => {
    document.appendParagraph(text ?? '');
  });

  const created = document.getParagraphs?.() ?? [];
  // 標題置中（Univer 的段落物件提供 setStyle）
  for (const index of template.centeredIndexes ?? []) {
    try {
      created[index]?.setStyle?.({ horizontalAlign: 1 });
    } catch {
      // 段落樣式非必要，失敗不影響內容
    }
  }

  return { document, title: template.name };
}

export { SHEET_TEMPLATES, DOC_TEMPLATES, findSheetTemplate, findDocTemplate };
export type { SheetTemplateDefinition, DocTemplateDefinition, TemplateContext };
export { columnIndexToLetter };
