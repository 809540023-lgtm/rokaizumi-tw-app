/**
 * 資料庫回退機制
 * 當真實資料庫失敗時，使用靜態 JSON 數據
 */

import fs from 'fs';
import path from 'path';

interface FallbackCategory {
  id: number;
  name: string;
  description?: string;
}

interface FallbackProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  description?: string;
  specifications?: string;
  imageUrl?: string;
  status: string;
}

let fallbackProducts: FallbackProduct[] = [];
let fallbackCategories: FallbackCategory[] = [];
let isFallbackActive = false;

/**
 * 初始化回退資料庫
 */
export function initializeFallbackDB() {
  try {
    const productsPath = path.resolve(process.cwd(), 'client/public/products.json');
    
    if (fs.existsSync(productsPath)) {
      const data = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
      fallbackProducts = data;
      
      // 提取唯一分類
      const categories = new Set(data.map((p: any) => p.category));
      fallbackCategories = Array.from(categories).map((cat, idx) => ({
        id: idx + 1,
        name: cat as string,
        description: `分類: ${cat}`
      }));
      
      isFallbackActive = true;
      console.log('✅ 回退資料庫已初始化');
      console.log(`   產品: ${fallbackProducts.length}`);
      console.log(`   分類: ${fallbackCategories.length}`);
      return true;
    }
  } catch (error) {
    console.error('❌ 回退資料庫初始化失敗:', (error as Error).message);
  }
  return false;
}

/**
 * 獲取所有分類（回退版本）
 */
export async function getFallbackCategories() {
  if (!isFallbackActive) return [];
  return fallbackCategories;
}

/**
 * 獲取所有產品（回退版本）
 */
export async function getFallbackProducts() {
  if (!isFallbackActive) return [];
  return fallbackProducts;
}

/**
 * 按分類獲取產品（回退版本）
 */
export async function getFallbackProductsByCategory(categoryName: string) {
  if (!isFallbackActive) return [];
  return fallbackProducts.filter(p => p.category === categoryName);
}

/**
 * 搜尋產品（回退版本）
 */
export async function searchFallbackProducts(query: string) {
  if (!isFallbackActive) return [];
  const lowerQuery = query.toLowerCase();
  return fallbackProducts.filter(p =>
    p.name.toLowerCase().includes(lowerQuery) ||
    (p.description?.toLowerCase().includes(lowerQuery) ?? false)
  );
}

export { isFallbackActive };
