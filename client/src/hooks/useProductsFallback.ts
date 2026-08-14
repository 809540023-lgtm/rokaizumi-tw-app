/**
 * 產品數據 Hook - 帶回退支持
 * 如果 API 失敗，自動從靜態 products.json 加載
 */

import { useEffect, useState } from 'react';

export interface Product {
  id: number;
  name: string;
  nameJa?: string;
  category: string;
  price: number;
  priceJpy?: number;
  description?: string;
  specifications?: string;
  imageUrl?: string;
  images?: string[];
  status?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}

export function useProductsFallback() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);

        // 首先嘗試從靜態 JSON 加載
        const response = await fetch('/products.json');
        if (!response.ok) throw new Error('無法加載 products.json');

        const data: Product[] = await response.json();
        setProducts(data);

        // 提取唯一分類
        const categorySet = new Set(data.map(p => p.category));
        const uniqueCategories: Category[] = Array.from(categorySet).map((cat, idx) => ({
          id: idx + 1,
          name: cat,
          description: `分類: ${cat}`
        }));
        setCategories(uniqueCategories);

        setIsFallback(true);
        setError(null);

        console.log('✅ 從靜態數據加載產品:', data.length, '項');
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知錯誤';
        console.error('❌ 加載產品失敗:', message);
        setError(message);
        setProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  return {
    products,
    categories,
    loading,
    error,
    isFallback
  };
}
