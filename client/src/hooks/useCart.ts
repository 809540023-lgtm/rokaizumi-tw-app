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

export interface CartLine {
  productId: number;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
}

function read(): CartLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(l => l && typeof l.productId === 'number') : [];
  } catch {
    return [];
  }
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    /* 隱私模式或空間不足時忽略，畫面仍會更新 */
  }
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

export function useCart() {
  const [lines, setLines] = useState<CartLine[]>(read);

  useEffect(() => {
    const sync = () => setLines(read());
    window.addEventListener(CART_EVENT, sync);
    // 其他分頁改動時也要跟上
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const add = useCallback((item: Omit<CartLine, 'quantity'>, quantity = 1) => {
    const next = read();
    const existing = next.find(l => l.productId === item.productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      next.push({ ...item, quantity });
    }
    write(next);
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    const next = read()
      .map(l => (l.productId === productId ? { ...l, quantity: Math.max(0, quantity) } : l))
      .filter(l => l.quantity > 0);
    write(next);
  }, []);

  const remove = useCallback((productId: number) => {
    write(read().filter(l => l.productId !== productId));
  }, []);

  const clear = useCallback(() => write([]), []);

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((n, l) => n + l.price * l.quantity, 0);

  return { lines, add, setQuantity, remove, clear, itemCount, total };
}
