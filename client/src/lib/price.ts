/**
 * 價格顯示
 *
 * 資料庫的 price 欄位一律是「日圓」——兩份來源都是日本網站抓來的
 * （scrio 的 price_jpy、KOKUBO 的 priceJpy）。
 *
 * 但先前各頁面直接把這個數字掛上 NT$ 顯示（¥209 的濾水籃變成 NT$209，
 * 約為實際售價的 4.4 倍），日文版還把日圓再乘 4.5。
 * 這裡統一換算，避免每個頁面各自寫一套。
 */

/** 匯率取自 drizzle schema 的預設值：JPY→USD 0.0075、USD→TWD 30 */
const JPY_TO_USD = 0.0075;
const USD_TO_TWD = 30;
const JPY_TO_TWD = JPY_TO_USD * USD_TO_TWD; // 0.225

export type PriceLanguage = 'zh' | 'cn' | 'ja' | 'en';

/** 把日圓價格換算成該語言對應的幣別字串 */
export function formatPrice(priceJpy: number, language: string): string {
  const jpy = Number.isFinite(priceJpy) ? Math.max(0, Math.round(priceJpy)) : 0;

  switch (language) {
    case 'ja':
      // 本來就是日圓，不需換算
      return new Intl.NumberFormat('ja-JP', {
        style: 'currency',
        currency: 'JPY',
        maximumFractionDigits: 0,
      }).format(jpy);
    case 'en':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(jpy * JPY_TO_USD);
    case 'zh':
    case 'cn':
    default:
      return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
        maximumFractionDigits: 0,
      }).format(Math.round(jpy * JPY_TO_TWD));
  }
}

/** 只要數值不要幣別符號（例如計算小計時） */
export function convertPrice(priceJpy: number, language: string): number {
  const jpy = Number.isFinite(priceJpy) ? Math.max(0, priceJpy) : 0;
  if (language === 'ja') return Math.round(jpy);
  if (language === 'en') return Number((jpy * JPY_TO_USD).toFixed(2));
  return Math.round(jpy * JPY_TO_TWD);
}
