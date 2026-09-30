/**
 * 表格範本庫。
 *
 * 範本用「列 × 儲存格」的簡單結構描述，再由 applySheetTemplate 用 Facade API 寫進 Univer。
 * 刻意不直接產生 Univer 的 IWorkbookData：那個格式屬於內部結構，
 * 版本之間會變動；Facade API 才是官方保證的對外介面。
 */

import type { CellSpec, RangeStyle, SheetTemplateDefinition, SheetTemplateLayout, TemplateContext } from '../types';

const cell = (v: string | number | null): CellSpec => ({ v });
const formula = (f: string): CellSpec => ({ f: f.replace(/^=/, '') });
const blank = (): null => null;

/** 依列號產生空的預留列 */
function emptyRows(count: number, columns: number): Array<Array<CellSpec | null>> {
  return Array.from({ length: count }, () => Array.from({ length: columns }, blank));
}

function headerStyle(range: string, background = '#0ABAB5'): RangeStyle[] {
  return [
    { range, bold: true, fontColor: '#FFFFFF', background, horizontalAlign: 'center', verticalAlign: 'middle' },
  ];
}

function today(context?: TemplateContext): string {
  return context?.today ?? new Date().toLocaleDateString('zh-TW');
}

function company(context?: TemplateContext): string {
  return context?.company ?? 'ろかいずみ株式会社';
}

/* ------------------------------------------------------------------ */
/* 報價單                                                              */
/* ------------------------------------------------------------------ */
const quotation: SheetTemplateDefinition = {
  key: 'quotation',
  name: '報價單',
  description: '客戶報價用，含品項、單價、數量、小計與總計（自動加總）',
  icon: 'FileText',
  build: (context) => {
    const itemRows = 10;
    const firstItemRow = 7;
    const lastItemRow = firstItemRow + itemRows - 1;

    const rows: Array<Array<CellSpec | null>> = [
      [cell('報價單 QUOTATION'), blank(), blank(), blank(), blank(), blank()],
      [blank(), blank(), blank(), blank(), blank(), blank()],
      [cell('客戶名稱'), cell(''), blank(), cell('報價日期'), cell(today(context)), blank()],
      [cell('聯絡人'), cell(''), blank(), cell('報價單號'), cell(''), blank()],
      [cell('聯絡電話'), cell(''), blank(), cell('有效期限'), cell('14 天'), blank()],
      [blank(), blank(), blank(), blank(), blank(), blank()],
      [cell('品名 / 規格'), cell('型號'), cell('單價'), cell('數量'), cell('小計'), cell('備註')],
      ...emptyRows(itemRows, 6),
      [blank(), blank(), blank(), blank(), cell('小計'), formula(`SUM(E${firstItemRow}:E${lastItemRow})`)],
      [blank(), blank(), blank(), blank(), cell('營業稅 5%'), formula('E17*0.05')],
      [blank(), blank(), blank(), blank(), cell('總計'), formula('E17+E18')],
      [blank(), blank(), blank(), blank(), blank(), blank()],
      [cell('備註：'), cell(''), blank(), blank(), blank(), blank()],
      [cell('1. 本報價有效期限如上，逾期請重新確認。'), blank(), blank(), blank(), blank(), blank()],
      [cell('2. 交期與運費另計，實際依雙方確認之訂單為準。'), blank(), blank(), blank(), blank(), blank()],
      [blank(), blank(), blank(), blank(), blank(), blank()],
      [cell(`報價廠商：${company(context)}`), blank(), blank(), blank(), cell('客戶簽章'), cell('')],
    ];

    return {
      sheetName: '報價單',
      rows,
      columnWidths: { 0: 260, 1: 120, 2: 110, 3: 90, 4: 130, 5: 180 },
      rowHeights: { 0: 46, 6: 34 },
      merges: ['A1:F1', 'A3:B3', 'A4:B4', 'A5:B5', 'A10:B10', 'A13:F13', 'A14:F14', 'A15:F15'],
      styles: [
        ...headerStyle('A1:F1'),
        { range: 'A1:F1', fontSize: 18 },
        ...headerStyle('A7:F7', '#334155'),
        { range: 'A3:B5', bold: true, background: '#F1F5F9' },
        { range: 'E9:E11', bold: true, background: '#F1F5F9', horizontalAlign: 'right' },
        { range: 'F9:F11', bold: true, numberFormat: '#,##0' },
        { range: 'C8:E20', numberFormat: '#,##0' },
        { range: 'A7:F20', border: 'all' },
        { range: 'C3:C5', background: '#F1F5F9', bold: true },
        { range: 'A13:F15', fontColor: '#64748B', fontSize: 11 },
      ],
      freezeRows: 7,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 進貨 / 採購單                                                        */
/* ------------------------------------------------------------------ */
const purchase: SheetTemplateDefinition = {
  key: 'purchase',
  name: '進貨單',
  description: '日本叫貨用，含日圓單價、匯率換算與到貨追蹤',
  icon: 'Package',
  build: (context) => {
    const itemRows = 12;
    const first = 6;
    const last = first + itemRows - 1;
    return {
      sheetName: '進貨單',
      rows: [
        [cell('進貨單 PURCHASE ORDER'), blank(), blank(), blank(), blank(), blank(), blank()],
        [cell('供應商'), cell(''), blank(), cell('下單日期'), cell(today(context)), blank(), blank()],
        [cell('聯絡人'), cell(''), blank(), cell('預計到貨'), cell(''), blank(), blank()],
        [cell('付款條件'), cell(''), blank(), cell('匯率 JPY→TWD'), cell(0.21), blank(), blank()],
        [blank(), blank(), blank(), blank(), blank(), blank(), blank()],
        [cell('品名'), cell('JAN / 型號'), cell('日圓單價'), cell('數量'), cell('小計(¥)'), cell('小計(TWD)'), cell('備註')],
        ...emptyRows(itemRows, 7),
        [blank(), blank(), blank(), blank(), cell('合計(¥)'), formula(`SUM(E${first}:E${last})`), blank()],
        [blank(), blank(), blank(), blank(), cell('合計(TWD)'), formula('E19*$E$4'), blank()],
        [blank(), blank(), blank(), blank(), cell('國際運費'), cell(''), blank()],
        [blank(), blank(), blank(), blank(), cell('關稅與稅金'), cell(''), blank()],
        [blank(), blank(), blank(), blank(), cell('到岸總成本'), formula('F19+F21+F22'), blank()],
      ],
      columnWidths: { 0: 240, 1: 150, 2: 110, 3: 90, 4: 120, 5: 130, 6: 150 },
      rowHeights: { 0: 44 },
      merges: ['A1:G1', 'A2:B2', 'A3:B3', 'A4:B4', 'A19:D19', 'A20:D20', 'A21:D21', 'A22:D22', 'A23:D23'],
      styles: [
        ...headerStyle('A1:G1'),
        { range: 'A1:G1', fontSize: 18 },
        ...headerStyle('A6:G6', '#334155'),
        { range: 'A2:B4', bold: true, background: '#F1F5F9' },
        { range: 'C3:C3', background: '#F1F5F9', bold: true },
        { range: 'A19:A23', bold: true, background: '#F1F5F9', horizontalAlign: 'right' },
        { range: 'C7:C23', numberFormat: '#,##0' },
        { range: 'E7:F23', numberFormat: '#,##0' },
        { range: 'A6:G23', border: 'all' },
      ],
      freezeRows: 6,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 庫存盤點表                                                          */
/* ------------------------------------------------------------------ */
const inventory: SheetTemplateDefinition = {
  key: 'inventory',
  name: '庫存盤點表',
  description: '盤點用，含理論庫存、實際盤點與差異自動計算',
  icon: 'ClipboardList',
  build: (context) => {
    const rows = 30;
    const first = 5;
    const last = first + rows - 1;
    return {
      sheetName: '庫存盤點',
      rows: [
        [cell('庫存盤點表 STOCK TAKE'), blank(), blank(), blank(), blank(), blank(), blank(), blank()],
        [cell('盤點日期'), cell(today(context)), blank(), cell('盤點人員'), cell(''), blank(), blank(), blank()],
        [blank(), blank(), blank(), blank(), blank(), blank(), blank(), blank()],
        [cell('SKU'), cell('品名'), cell('規格'), cell('理論庫存'), cell('實際庫存'), cell('差異'), cell('差異金額'), cell('備註')],
        ...emptyRows(rows, 8),
        [blank(), blank(), blank(), cell('合計'), formula(`SUM(E${first}:E${last})`), formula(`SUM(F${first}:F${last})`), formula(`SUM(G${first}:G${last})`), blank()],
      ],
      columnWidths: { 0: 140, 1: 240, 2: 130, 3: 100, 4: 100, 5: 90, 6: 120, 7: 180 },
      rowHeights: { 0: 44 },
      merges: ['A1:H1'],
      styles: [
        ...headerStyle('A1:H1'),
        { range: 'A1:H1', fontSize: 18 },
        ...headerStyle('A4:H4', '#334155'),
        { range: 'A2:A2', bold: true, background: '#F1F5F9' },
        { range: 'A5:H35', border: 'all' },
        { range: 'F5:F35', bold: true, fontColor: '#DC2626' },
        { range: 'G5:G36', numberFormat: '#,##0' },
        { range: 'A36:H36', bold: true, background: '#F1F5F9' },
      ],
      freezeRows: 4,
    };
  },
};

/* ------------------------------------------------------------------ */
/* 成本毛利試算                                                        */
/* ------------------------------------------------------------------ */
const costing: SheetTemplateDefinition = {
  key: 'costing',
  name: '成本毛利試算',
  description: '從日圓進貨價一路算到台灣售價與毛利率（含關稅、運費攤提、通路抽成）',
  icon: 'Calculator',
  build: () => {
    const rows: Array<Array<CellSpec | null>> = [
      [cell('成本毛利試算表 COST & MARGIN'), blank(), blank(), blank()],
      [blank(), blank(), blank(), blank()],
      [cell('【進貨條件】'), blank(), blank(), blank()],
      [cell('日圓進貨單價 (¥)'), cell(320), blank(), cell('改這格')],
      [cell('一次進貨數量'), cell(600), blank(), blank()],
      [cell('匯率 JPY→TWD'), cell(0.21), blank(), blank()],
      [cell('匯率緩衝 %'), cell(2), blank(), blank()],
      [blank(), blank(), blank(), blank()],
      [cell('【費用項目】'), cell('金額 (TWD)'), cell('計算方式'), blank()],
      [cell('貨款'), formula('B4*B5*B6*(1+B7/100)'), cell('日圓單價 × 數量 × 匯率 × 緩衝'), blank()],
      [cell('國際運費'), cell(0), cell('依實際報價填入'), blank()],
      [cell('日本國內運費'), cell(0), cell('依實際報價填入'), blank()],
      [cell('進口關稅 2.5%'), formula('(B11+B12+B13)*0.025'), blank(), blank()],
      [cell('推廣貿易服務費 0.0415%'), formula('(B11+B12+B13)*0.000415'), blank(), blank()],
      [cell('營業稅 5%'), formula('(B11+B12+B13+B14)*0.05'), blank(), blank()],
      [cell('報關與規費'), cell(1200), blank(), blank()],
      [cell('包裝費 (每件 8 元)'), formula('8*B5'), blank(), blank()],
      [cell('耗損 2%'), formula('SUM(B11:B18)*0.02'), blank(), blank()],
      [blank(), blank(), blank(), blank()],
      [cell('到岸總成本'), formula('SUM(B11:B19)'), blank(), blank()],
      [cell('單件成本'), formula('B20/B5'), blank(), blank()],
      [blank(), blank(), blank(), blank()],
      [cell('【定價】'), cell('金額 (TWD)'), cell('毛利率'), blank()],
      [cell('目標批發毛利率 %'), cell(35), blank(), blank()],
      [cell('目標零售毛利率 %'), cell(62), blank(), blank()],
      [cell('建議批發價'), formula('B21/(1-B24/100)'), formula('(B27-B21)/B27'), blank()],
      [cell('建議零售價'), formula('B21/(1-B25/100)'), formula('(B28-B21)/B28'), blank()],
      [cell('通路抽成 %'), cell(8), blank(), blank()],
      [cell('零售淨收入'), formula('B28*(1-B29/100)'), blank(), blank()],
      [cell('零售實際毛利 %'), formula('(B30-B21)/B30'), blank(), blank()],
    ];
    return {
      sheetName: '成本試算',
      rows,
      columnWidths: { 0: 260, 1: 150, 2: 240, 3: 120 },
      rowHeights: { 0: 44 },
      merges: ['A1:D1'],
      styles: [
        ...headerStyle('A1:D1'),
        { range: 'A1:D1', fontSize: 18 },
        { range: 'A3:D3', bold: true, background: '#E2E8F0' },
        { range: 'A9:D9', bold: true, background: '#E2E8F0' },
        { range: 'A23:D23', bold: true, background: '#E2E8F0' },
        { range: 'A4:A7', bold: true, background: '#F8FAFC' },
        { range: 'B4:B7', background: '#FEF9C3' },
        { range: 'A10:A21', background: '#F8FAFC' },
        { range: 'B4:B30', numberFormat: '#,##0.00' },
        { range: 'C27:C28', numberFormat: '0.00%' },
        { range: 'B31:B31', numberFormat: '0.00%' },
        { range: 'A20:D21', bold: true, background: '#0ABAB5', fontColor: '#FFFFFF' },
        { range: 'A9:D21', border: 'all' },
        { range: 'A23:D30', border: 'all' },
        { range: 'A27:B28', bold: true },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* 日報 / 工作日誌                                                      */
/* ------------------------------------------------------------------ */
const dailyReport: SheetTemplateDefinition = {
  key: 'daily-report',
  name: '工作日誌',
  description: '每天記錄工作內容、工時與待辦',
  icon: 'CalendarCheck',
  build: (context) => ({
    sheetName: '工作日誌',
    rows: [
      [cell('工作日誌 DAILY LOG'), blank(), blank(), blank(), blank()],
      [cell('日期'), cell(today(context)), blank(), cell('填寫人'), cell('')],
      [blank(), blank(), blank(), blank(), blank()],
      [cell('時段'), cell('工作內容'), cell('對象 / 地點'), cell('工時'), cell('狀態')],
      ...emptyRows(12, 5),
      [blank(), blank(), blank(), cell('合計'), formula('SUM(D5:D16)')],
      [blank(), blank(), blank(), blank(), blank()],
      [cell('今日待辦 / 明日重點'), blank(), blank(), blank(), blank()],
      ...[0, 1, 2].map(() => [cell(''), blank(), blank(), blank(), blank()] as Array<CellSpec | null>),
      [blank(), blank(), blank(), blank(), blank()],
      [cell('主管確認'), cell(''), blank(), cell('日期'), cell('')],
    ],
    columnWidths: { 0: 130, 1: 380, 2: 200, 3: 90, 4: 110 },
    rowHeights: { 0: 44, 17: 30 },
    merges: ['A1:E1', 'A17:E17', 'A18:E18', 'A19:E19', 'A20:E20'],
    styles: [
      ...headerStyle('A1:E1'),
      { range: 'A1:E1', fontSize: 18 },
      ...headerStyle('A4:E4', '#334155'),
      { range: 'A2:A2', bold: true, background: '#F1F5F9' },
      { range: 'D2:D2', bold: true, background: '#F1F5F9' },
      { range: 'A5:E20', border: 'all' },
      { range: 'A4:E16', border: 'all' },
      { range: 'D17:E17', bold: true, background: '#F1F5F9' },
      { range: 'A17:E20', background: '#FFFBEB', wrap: true },
    ],
    freezeRows: 4,
  }),
};

/* ------------------------------------------------------------------ */
/* 空白表格                                                            */
/* ------------------------------------------------------------------ */
const blankSheet: SheetTemplateDefinition = {
  key: 'blank',
  name: '空白表格',
  description: '乾淨的空白表格',
  icon: 'Table',
  build: () => ({
    sheetName: '工作表 1',
    rows: [[cell('')]],
    columnWidths: {},
    styles: [],
  }),
};

export const SHEET_TEMPLATES: SheetTemplateDefinition[] = [
  quotation,
  purchase,
  inventory,
  costing,
  dailyReport,
  blankSheet,
];

export function findSheetTemplate(key: string): SheetTemplateDefinition | undefined {
  return SHEET_TEMPLATES.find((t) => t.key === key);
}
