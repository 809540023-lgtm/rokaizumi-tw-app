/**
 * 資料庫回退機制
 * 當真實資料庫查詢失敗時，使用靜態 JSON 數據
 *
 * 注意：本檔案會被 esbuild 打包成 ESM，__dirname 不可用，
 * 一律以 process.cwd() 為基準搜尋候選路徑。
 */

import fs from 'fs';
import path from 'path';
import type { Product } from '../drizzle/schema';

interface FallbackCategory {
  id: number;
  name: string;
  description?: string;
}

type ProductListItem = Pick<
  Product,
  | 'id'
  | 'name'
  | 'description'
  | 'price'
  | 'categoryId'
  | 'imageUrl'
  | 'images'
  | 'status'
  | 'stock'
  | 'lowStockThreshold'
>;

interface FallbackProduct extends ProductListItem {
  nameJa?: string;
  priceJpy?: number;
  category: string;
  specifications?: string;
}

let fallbackProducts: FallbackProduct[] = [];
let fallbackCategories: FallbackCategory[] = [];
let isFallbackActive = false;

/** 依序尋找 products.json，回傳第一個存在的路徑 */
function resolveProductsPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'dist/public/products.json'),
    path.resolve(process.cwd(), 'server/public/products.json'),
    path.resolve(process.cwd(), 'client/public/products.json'),
    path.resolve(process.cwd(), 'public/products.json'),
  ];
  return candidates.find(p => fs.existsSync(p)) ?? null;
}

/**
 * 初始化回退資料庫。
 * 會在啟動時無條件呼叫一次——資料庫是否正常都先把靜態資料讀進記憶體，
 * 這樣任何一個查詢在執行期失敗時都能立刻接手。
 */
export function initializeFallbackDB() {
  try {
    const productsPath = resolveProductsPath();

    if (!productsPath) {
      console.warn('⚠️  找不到 products.json，回退資料庫未啟用');
      return false;
    }

    const data = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
    if (!Array.isArray(data) || data.length === 0) {
      console.warn('⚠️  products.json 內容為空，回退資料庫未啟用');
      return false;
    }

    // 分類先建好，再把 categoryId 回填到每個商品，
    // 讓前端不論拿到 DB 資料還是回退資料都有一致的欄位。
    const names = Array.from(new Set(data.map((p: any) => p.category).filter(Boolean)));
    fallbackCategories = names.map((name, idx) => ({
      id: idx + 1,
      name: name as string,
      description: `分類: ${name}`,
    }));

    const idByName = new Map(fallbackCategories.map(c => [c.name, c.id]));
    fallbackProducts = data.map((p: {
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
      stock?: number;
      lowStockThreshold?: number;
    }) => ({
      id: p.id,
      name: p.name,
      nameJa: p.nameJa,
      category: p.category,
      categoryId: idByName.get(p.category) ?? 0,
      price: p.price,
      priceJpy: p.priceJpy,
      description: p.description ?? null,
      specifications: p.specifications,
      imageUrl: p.imageUrl ?? null,
      images: p.images ?? null,
      status: p.status === 'sold' || p.status === 'reserved' ? p.status : 'available',
      stock: p.stock ?? 0,
      lowStockThreshold: p.lowStockThreshold ?? 5,
    }));

    isFallbackActive = true;
    console.log(`✅ 回退資料庫已初始化 (${productsPath})`);
    console.log(`   產品: ${fallbackProducts.length}  分類: ${fallbackCategories.length}`);
    return true;
  } catch (error) {
    console.error('❌ 回退資料庫初始化失敗:', (error as Error).message);
    return false;
  }
}

export async function getFallbackCategories() {
  return fallbackCategories;
}

export async function getFallbackProducts() {
  return fallbackProducts;
}

export async function getFallbackProductById(id: number) {
  return fallbackProducts.find(p => p.id === id) ?? null;
}

export async function getFallbackCategoryById(id: number) {
  return fallbackCategories.find(c => c.id === id) ?? null;
}

export async function getFallbackProductsByCategory(categoryId: number) {
  return fallbackProducts.filter(p => p.categoryId === categoryId);
}

export async function searchFallbackProducts(query: string) {
  const q = query.toLowerCase();
  return fallbackProducts.filter(
    p =>
      p.name.toLowerCase().includes(q) ||
      (p.nameJa?.toLowerCase().includes(q) ?? false) ||
      (p.description?.toLowerCase().includes(q) ?? false)
  );
}

export { isFallbackActive };
