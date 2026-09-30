/**
 * Excel（.xlsx）讀寫。
 *
 * 用動態 import 載入 xlsx，讓它與 Univer 一起被切到獨立的 chunk，
 * 不會拖慢網站首頁（首頁完全不會載到這支）。
 *
 * 已知限制：
 *   xlsx 這個 npm 版本只還原「值」，不還原公式與樣式。
 *   若需要保留公式，請用「Univer 快照（JSON）」存檔，那是本系統的主要存檔格式。
 */

export interface XlsxSheetData {
  name: string;
  rows: Array<Array<string | number | boolean | null>>;
}

async function loadXlsx() {
  const mod = await import('xlsx');
  return (mod as unknown as { default?: unknown }).default ?? mod;
}

/** 把二維矩陣轉成 .xlsx Blob */
export async function matrixToXlsxBlob(
  matrix: Array<Array<string | number | boolean | null>>,
  sheetName = 'Sheet1',
): Promise<Blob> {
  const XLSX = (await loadXlsx()) as any;
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** 讀取 .xlsx，回傳每個工作表的名稱與內容 */
export async function xlsxFileToSheets(file: File | Blob): Promise<XlsxSheetData[]> {
  const XLSX = (await loadXlsx()) as any;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  return (workbook.SheetNames as string[]).map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    }) as Array<Array<string | number | boolean | null>>;
    return { name, rows };
  });
}
