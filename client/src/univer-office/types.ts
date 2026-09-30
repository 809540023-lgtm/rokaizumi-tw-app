/**
 * Univer Office Kit — 共用型別
 */

export type DocumentKind = 'sheet' | 'doc';

/** 後端回傳的文件中繼資料（不含內容） */
export interface OfficeDocumentMeta {
  id: string;
  title: string;
  kind: DocumentKind;
  templateKey?: string | null;
  currentVersion: number;
  ownerId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 後端回傳的文件（含內容快照） */
export interface OfficeDocumentDetail extends OfficeDocumentMeta {
  content: unknown;
}

export interface OfficeDocumentVersion {
  id: number;
  documentId: string;
  version: number;
  note?: string | null;
  createdBy?: number | null;
  createdAt?: string;
  sizeBytes?: number;
}

/* ---------------- 範本 ---------------- */

export interface CellSpec {
  v?: string | number | boolean | null;
  /** 公式，例如 '=B2*C2'（不用加開頭的 = 也可以，會自動補） */
  f?: string;
}

export interface RangeStyle {
  range: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  fontColor?: string;
  background?: string;
  horizontalAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  /** Univer 數字格式，例如 '#,##0' 或 '0.00%' */
  numberFormat?: string;
  border?: 'all' | 'outside' | 'bottom' | 'none';
}

export interface SheetTemplateLayout {
  sheetName: string;
  /** 每一列；null 代表整列留白 */
  rows: Array<Array<CellSpec | string | number | null> | null>;
  columnWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  /** 合併範圍，例如 'A1:F1' */
  merges?: string[];
  styles?: RangeStyle[];
  freezeRows?: number;
}

export interface SheetTemplateDefinition {
  key: string;
  name: string;
  description: string;
  icon?: string;
  build: (context?: TemplateContext) => SheetTemplateLayout;
}

export interface DocTemplateDefinition {
  key: string;
  name: string;
  description: string;
  icon?: string;
  /** 段落陣列；每個字串一段，空字串代表空行 */
  build: (context?: TemplateContext) => string[];
  /** 置中段落索引 */
  centeredIndexes?: number[];
}

export interface TemplateContext {
  company?: string;
  operator?: string;
  today?: string;
}

/* ---------------- 儲存 ---------------- */

export interface SavePayload {
  id?: string;
  title: string;
  kind: DocumentKind;
  templateKey?: string | null;
  /** Univer 快照（IWorkbookData 或 IDocumentData） */
  content: unknown;
  note?: string;
}

/**
 * 後端串接點。全部都是可選的：
 * 沒有提供時，UI 只會顯示「未連接後端」，其他功能（範本、匯入匯出）照常可用。
 */
export interface OfficeKitHandlers {
  listDocuments?: () => Promise<OfficeDocumentMeta[]>;
  loadDocument?: (id: string) => Promise<OfficeDocumentDetail | null>;
  /** 存檔（更新現有版本，不新增版本紀錄） */
  saveDocument?: (payload: SavePayload) => Promise<OfficeDocumentMeta>;
  /** 另存新版本（保留歷史） */
  saveVersion?: (payload: SavePayload) => Promise<OfficeDocumentMeta>;
  listVersions?: (documentId: string) => Promise<OfficeDocumentVersion[]>;
  restoreVersion?: (documentId: string, version: number) => Promise<OfficeDocumentDetail>;
  deleteDocument?: (id: string) => Promise<void>;
}

export type SaveHandler = (payload: SavePayload) => Promise<OfficeDocumentMeta>;
export type LoadHandler = (id: string) => Promise<OfficeDocumentDetail | null>;
export type ListHandler = () => Promise<OfficeDocumentMeta[]>;

