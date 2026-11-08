import { describe, expect, it } from 'vitest';
import { hasPurchasablePrice, matchesProductSearch, pricePendingText } from './catalog';
import { formatCatalogPrice, formatPrice } from '../client/src/lib/price';

describe('catalog safety and search', () => {
  it.each([0, -10, null, undefined, '', '100', NaN, Infinity, 1.5])('blocks invalid price %s', price => {
    expect(hasPurchasablePrice(price)).toBe(false);
  });
  it('accepts actual yen prices and preserves zero totals', () => {
    expect(hasPurchasablePrice(209)).toBe(true);
    expect(formatCatalogPrice(209, 'ja')).toBe(formatPrice(209, 'ja'));
    expect(formatPrice(0, 'ja')).toContain('0');
    for (const language of ['ja', 'zh', 'cn', 'en']) {
      expect(formatCatalogPrice(0, language)).toBe(pricePendingText(language));
      expect(formatCatalogPrice(NaN, language)).toBe(pricePendingText(language));
    }
  });
  it('searches the English name independently of the original name', () => {
    const product = { name: '收納架', nameJa: '収納ラック', nameEn: 'Document Storage Rack' };
    expect(matchesProductSearch(product, 'storage rack')).toBe(true);
    expect(matchesProductSearch(product, 'ＤＯＣＵＭＥＮＴ')).toBe(true);
    expect(matchesProductSearch({ ...product, nameEn: null }, 'storage')).toBe(false);
  });
  it('searches the catalog JAN barcode and product code', () => {
    const product = { name: '收納架', jan: '4956810234567', code: 'KK-123' };
    expect(matchesProductSearch(product, '4956810234567')).toBe(true);
    expect(matchesProductSearch(product, 'kk-123')).toBe(true);
    expect(matchesProductSearch(product, '4956810999999')).toBe(false);
  });
  it('returns no matches for an absent query and supports multilingual text and width normalization', () => {
    const product = { name: '收納架', nameJa: '収納ラック', description: 'KOKUBO A123' };
    expect(matchesProductSearch(product, 'audit-no-match-20261109')).toBe(false);
    expect(matchesProductSearch(product, '収納')).toBe(true);
    expect(matchesProductSearch(product, ' ｋｏｋｕｂｏ  Ａ１２３ ')).toBe(true);
    expect(matchesProductSearch(product, 'KOKUBO missing')).toBe(false);
    expect(matchesProductSearch(product, '  ')).toBe(true);
  });
});
