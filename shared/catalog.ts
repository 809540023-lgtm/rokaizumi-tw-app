/** A missing catalog price is a quote request, never a free product. */
export function hasPurchasablePrice(price: unknown): price is number {
  return typeof price === 'number' && Number.isSafeInteger(price) && price > 0;
}

export function pricePendingText(language: string): string {
  switch (language) {
    case 'ja': return '価格確認中・お問い合わせください';
    case 'en': return 'Price to be confirmed · Contact us';
    case 'cn': return '价格待确认，请联系我们';
    default: return '價格待確認，請聯絡我們';
  }
}

export function matchesProductSearch(product: {
  name?: string | null; nameJa?: string | null; nameEn?: string | null; description?: string | null;
  specifications?: string | null; category?: string | null;
  jan?: string | null; code?: string | null;
}, query: string): boolean {
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase();
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const content = normalize([product.name, product.nameJa, product.nameEn, product.description, product.specifications, product.category, product.jan, product.code].filter(Boolean).join(' '));
  return words.every(word => content.includes(word));
}
