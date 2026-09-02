export const LINE_ADD_FRIEND_URL = "https://lin.ee/uyIojIh";
export const LINE_OFFICIAL_ACCOUNT_ID = "@354jmxjn";

type LineInquiryProduct = {
  nameJa: string;
  catalog?: string | null;
  barcode: string;
  retailPriceTwd: number;
};

export function buildLineOfficialMessageUrl(message: string) {
  return `https://line.me/R/oaMessage/${encodeURIComponent(LINE_OFFICIAL_ACCOUNT_ID)}/?${encodeURIComponent(message)}`;
}

export function buildAgLineInquiryUrl(product: LineInquiryProduct) {
  const message = [
    "您好，我想詢問這件商品：",
    product.nameJa,
    product.catalog ? `型號：${product.catalog}` : null,
    `JAN：${product.barcode}`,
    `售價：NT$${product.retailPriceTwd}`,
    "商品頁：https://rokaizumi-tw.jp/ag",
  ]
    .filter(Boolean)
    .join("\n");

  return buildLineOfficialMessageUrl(message);
}
