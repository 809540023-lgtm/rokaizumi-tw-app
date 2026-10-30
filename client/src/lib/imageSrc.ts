/**
 * 商品圖幾乎都是外部圖床（kokubo.co.jp、www.yamadakagaku.co.jp、
 * kaigo.itembox.design）的直連網址。平常直接連對方最快，也吃得到對方的 CDN；
 * 只有載入失敗時才改走本站 /api/img 代理重試一次，這樣對方哪天開防盜連、
 * 或擋掉機房 IP，商品圖也不會變成破圖。
 *
 * 相對路徑、blob:、data: 一律原樣輸出。
 */
export function imgSrc(url?: string | null): string {
  return url ?? "";
}

/** 把原始網址轉成本站代理網址。 */
export function proxySrc(url: string): string {
  return `/api/img?url=${encodeURIComponent(url)}`;
}

/**
 * 全域攔截圖片載入失敗，改成走代理再試一次。
 *
 * 圖片載入失敗的 error 事件不會冒泡，所以要在 capture 階段攔。攔到之後
 * 呼叫 stopPropagation，讓這次失敗不要傳到元件的 onError（否則元件會立刻
 * 退成文字方塊，代理都還沒試）。代理若也失敗，錯誤會再來一次，那時 src
 * 已經是相對路徑、不會再被這裡接手，就會正常交給元件顯示替代內容。
 *
 * data-img-fallback 記住「哪個原始網址已經重試過」，換成別的圖就會重新
 * 取得一次救援機會，也避免同一張圖無限重試。
 */
export function installImageFallback(): void {
  if (typeof window === "undefined") return;
  window.addEventListener(
    "error",
    event => {
      const target = event.target as HTMLImageElement | null;
      if (!target || target.tagName !== "IMG") return;
      const src = target.currentSrc || target.src;
      if (!/^https?:\/\//i.test(src)) return;
      if (target.dataset.imgFallback === src) return;
      target.dataset.imgFallback = src;
      target.src = proxySrc(src);
      event.stopPropagation();
    },
    true
  );
}
