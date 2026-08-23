/**
 * 訪客購物車
 *
 * 後端的 cart.* 是 protectedProcedure，未登入必定失敗；而商品資料在
 * 資料庫不通時來自靜態 products.json，那些 id 在資料庫裡並不存在，
 * 就算登入也寫不進去。所以購物車一律存在瀏覽器本機，
 * 結帳時才需要身分——這樣任何人都能先把商品加進去。
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'rokaizumi.cart.v1';
/** 同一分頁內的多個 useCart 實例要一起更新，用自訂事件廣播 */
const CART_EVENT = 'rokaizumi:cart-changed';
export const MAX_CART_QUANTITY = 99;

export interface CartLine {
  productId: number;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
}

function normalizeQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(MAX_CART_QUANTITY, Math.max(0, Math.floor(value)));
}

function normalizeLine(value: unknown): CartLine | null {
  if (!value || typeof value !== 'object') return null;
  const line = value as Partial<CartLine>;
  const productId = line.productId;
  const price = line.price;
  if (
    typeof productId !== 'number' ||
    !Number.isSafeInteger(productId) ||
    productId <= 0 ||
    typeof line.name !== 'string' ||
    !line.name.trim() ||
    typeof price !== 'number' ||
    !Number.isSafeInteger(price) ||
    price < 0
  ) {
    return null;
  }

  const quantity = normalizeQuantity(line.quantity);
  if (quantity < 1) return null;

  return {
    productId,
    name: line.name.trim(),
    price,
    ...(typeof line.imageUrl === 'string' && line.imageUrl ? { imageUrl: line.imageUrl } : {}),
    quantity,
  };
}

function read(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const lines = new Map<number, CartLine>();
    for (const value of parsed) {
      const line = normalizeLine(value);
      if (!line) continue;
      const existing = lines.get(line.productId);
      if (existing) {
        existing.quantity = Math.min(MAX_CART_QUANTITY, existing.quantity + line.quantity);
      } else {
        lines.set(line.productId, line);
      }
    }
    return Array.from(lines.values());
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* 隱私模式或空間不足時忽略，畫面仍會更新 */
  }
  window.dispatchEvent(new CustomEvent<CartLine[]>(CART_EVENT, { detail: lines }));
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(read);

  useEffect(() => {
    const sync = (event: Event) => {
      if (event instanceof CustomEvent && Array.isArray(event.detail)) {
        setLines(event.detail);
      } else {
        setLines(read());
      }
    };
    window.addEventListener(CART_EVENT, sync);
    // 其他分頁改動時也要跟上
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const add = useCallback((item: Omit<CartLine, 'quantity'>, quantity = 1) => {
    const normalizedItem = normalizeLine({ ...item, quantity: 1 });
    const amount = normalizeQuantity(quantity);
    if (!normalizedItem || amount < 1) return;

    const next = read();
    const existing = next.find(l => l.productId === normalizedItem.productId);
    if (existing) {
      existing.quantity = Math.min(MAX_CART_QUANTITY, existing.quantity + amount);
    } else {
      next.push({ ...normalizedItem, quantity: amount });
    }
    write(next);
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    if (!Number.isSafeInteger(productId) || productId <= 0) return;
    const next = read()
      .map(l => (l.productId === productId ? { ...l, quantity: normalizeQuantity(quantity) } : l))
      .filter(l => l.quantity > 0);
    write(next);
  }, []);

  const remove = useCallback((productId: number) => {
    if (!Number.isSafeInteger(productId) || productId <= 0) return;
    write(read().filter(l => l.productId !== productId));
  }, []);

  const clear = useCallback(() => write([]), []);

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((n, l) => n + l.price * l.quantity, 0);

  return { lines, add, setQuantity, remove, clear, itemCount, total };
}
