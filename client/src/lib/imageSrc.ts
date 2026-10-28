/**
 * 外部圖床的商品圖改走本站 /api/img 代理，避免對方開防盜連造成破圖，
 * 同時讓 Cloudflare 邊緣快取接手。相對路徑、blob:、data: 一律原樣回傳。
 */
const PROXIED_HOSTS = new Set([
  "kokubo.co.jp",
  "www.kokubo.co.jp",
  "www.yamadakagaku.co.jp",
  "kaigo.itembox.design",
]);

export function imgSrc(url?: string | null): string {
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) return url;

  try {
    const parsed = new URL(url);
    if (PROXIED_HOSTS.has(parsed.hostname.toLowerCase())) {
      return `/api/img?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // 解析失敗就照原樣輸出
  }
  return url;
}
