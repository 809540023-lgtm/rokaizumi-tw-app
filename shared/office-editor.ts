/**
 * 內嵌 Univer Office 編輯器（試算表／文檔）的網址組裝。
 *
 * 編輯器是獨立的靜態站（預設部署在 Render），用 iframe 內嵌時：
 * - `embed=1`：只顯示編輯器本體，隱藏外層標題
 * - `mode`：一開始要開試算表還是文檔
 * - `parentOrigin`：告訴編輯器只把 postMessage 發給這個來源（預設是 `*`）
 */
export const OFFICE_EDITOR_DEFAULT_URL = 'https://univer-office.onrender.com';

export type OfficeEditorMode = 'sheets' | 'docs';

export function buildOfficeEditorSrc(
  base: string,
  mode: OfficeEditorMode,
  parentOrigin: string
): string {
  const url = new URL(base);
  url.searchParams.set('embed', '1');
  url.searchParams.set('mode', mode);
  url.searchParams.set('parentOrigin', parentOrigin);
  return url.toString();
}
