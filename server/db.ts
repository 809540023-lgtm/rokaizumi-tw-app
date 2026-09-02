import { eq, desc, and, gte, lt, lte, avg, sql, or, like } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { agProducts, categories, products, trips, tripVideos, users, cartItems, orders, orderItems, reviews, wishlists, suppliers, purchases, announcements, apiKeys, apiLogs, type AgProduct, type Announcement, type ApiLog, type InsertAgProduct, type InsertCategory, type InsertProduct, type InsertTrip, type InsertTripVideo, type InsertCartItem, type InsertOrder, type InsertOrderItem, type InsertReview, type InsertWishlist, type InsertSupplier, type InsertPurchase, type InsertAnnouncement, type InsertApiKey, type InsertApiLog, type Order, type Product, type Review, type Trip, type TripVideo } from '../drizzle/schema';
import { ENV } from './_core/env';
import {
  initializeFallbackDB,
  isFallbackActive,
  getFallbackProducts,
  getFallbackCategories,
  getFallbackProductById,
  getFallbackCategoryById,
  getFallbackProductsByCategory,
  searchFallbackProducts,
} from './fallback-db';

// Create database connection
let pool: any;
let db: any;
let isDbConnected = false;

export type ProductListItem = Pick<
  Product,
  | 'id'
  | 'name'
  | 'nameJa'
  | 'nameEn'
  | 'origin'
  | 'description'
  | 'price'
  | 'categoryId'
  | 'imageUrl'
  | 'images'
  | 'status'
  | 'specifications'
  | 'stock'
  | 'lowStockThreshold'
>;

const publicProductColumns = {
  id: products.id,
  name: products.name,
  nameJa: products.nameJa,
  nameEn: products.nameEn,
  origin: products.origin,
  description: products.description,
  price: products.price,
  categoryId: products.categoryId,
  imageUrl: products.imageUrl,
  images: products.images,
  status: products.status,
  specifications: products.specifications,
  stock: products.stock,
  lowStockThreshold: products.lowStockThreshold,
};

function toPublicProduct(product: Record<string, any>): ProductListItem {
  return {
    id: product.id,
    name: product.name,
    nameJa: product.nameJa ?? null,
    nameEn: product.nameEn ?? null,
    origin: product.origin ?? null,
    description: product.description ?? null,
    price: product.price,
    categoryId: product.categoryId,
    imageUrl: product.imageUrl ?? null,
    images: product.images ?? null,
    status: product.status,
    specifications: product.specifications ?? null,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
  };
}

export type PublicAgProduct = Pick<
  AgProduct,
  | 'id'
  | 'barcode'
  | 'catalog'
  | 'nameJa'
  | 'nameEn'
  | 'countryOrigin'
  | 'retailPriceTwd'
  | 'imageUrl'
  | 'images'
  | 'size'
  | 'capacity'
  | 'material'
  | 'assortment'
  | 'status'
  | 'sortOrder'
>;

const publicAgProductColumns = {
  id: agProducts.id,
  barcode: agProducts.barcode,
  catalog: agProducts.catalog,
  nameJa: agProducts.nameJa,
  nameEn: agProducts.nameEn,
  countryOrigin: agProducts.countryOrigin,
  retailPriceTwd: agProducts.retailPriceTwd,
  imageUrl: agProducts.imageUrl,
  images: agProducts.images,
  size: agProducts.size,
  capacity: agProducts.capacity,
  material: agProducts.material,
  assortment: agProducts.assortment,
  status: agProducts.status,
  sortOrder: agProducts.sortOrder,
};

function getFallbackAgProducts(): PublicAgProduct[] {
  const file = [
    'dist/public/ag-products.json',
    'client/public/ag-products.json',
    'server/public/ag-products.json',
  ]
    .map(candidate => path.resolve(process.cwd(), candidate))
    .find(candidate => fs.existsSync(candidate));

  if (!file) return [];
  const rows = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<Record<string, any>>;
  return rows
    .filter(row => row.status === 'available')
    .map((row, index) => ({
      id: index + 1,
      barcode: String(row.barcode),
      catalog: row.catalog ?? null,
      nameJa: String(row.nameJa),
      nameEn: row.nameEn ?? null,
      countryOrigin: row.countryOrigin ?? null,
      retailPriceTwd: Number(row.retailPriceTwd) || 22,
      imageUrl: row.imageUrl ?? null,
      images: Array.isArray(row.images) ? row.images : null,
      size: row.size ?? null,
      capacity: row.capacity ?? null,
      material: row.material ?? null,
      assortment: row.assortment ?? null,
      status: 'available',
      sortOrder: Number(row.sortOrder) || index,
    }));
}

export type CategoryListItem = Pick<typeof categories.$inferSelect, 'id' | 'name'>;

// 靜態資料一律先載入。mysql.createPool() 是延遲連線、不會在這裡拋錯，
// 所以「資料庫是否真的能用」只有等第一個查詢跑下去才知道；
// 先把回退資料準備好，任何查詢在執行期失敗都能立刻接手。
initializeFallbackDB();

/**
 * 建立連線池設定。
 *
 * 公網託管的資料庫（TiDB Cloud、PlanetScale 等）強制要求 TLS，而 mysql2 預設
 * 不啟用；但本機與雲端內網（Render / VPC 私有位址）通常沒有憑證，強加 TLS
 * 反而會連不上。因此只對「公開網域」啟用，可用 DATABASE_SSL 覆寫。
 */
function isInternalHost(host: string): boolean {
  if (!host || host === 'localhost' || host === '127.0.0.1') return true;
  // RFC1918 私有網段：10.x / 172.16-31.x / 192.168.x
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

function buildPoolConfig(url: string) {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    /* 解析不了就當內網處理，不強制 TLS */
  }

  const override = process.env.DATABASE_SSL;
  const useSsl = override ? override !== 'false' : !isInternalHost(host);

  if (!useSsl) return url;
  return { uri: url, ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } };
}

try {
  if (ENV.databaseUrl) {
    pool = mysql.createPool(buildPoolConfig(ENV.databaseUrl) as any);
    db = drizzle(pool);
    isDbConnected = true;
    console.log('✅ 資料庫連線池已建立');

    // createPool 不會真的連線，這裡主動探測一次，把失敗盡早記錄下來，
    // 免得每個請求都要靠 withFallback 才發現資料庫其實不通。
    // 連得上就順便自檢：缺資料表就建、商品是空的就匯入。
    pool
      .query('SELECT 1')
      .then(async () => {
        console.log('✅ 資料庫連線測試通過');
        const { bootstrapDatabase } = await import('./bootstrap-db');
        await bootstrapDatabase(pool);
      })
      .catch((e: Error) => console.error('❌ 資料庫連線測試失敗:', e.message));
  } else {
    throw new Error('DATABASE_URL 未設置');
  }
} catch (error) {
  console.warn('⚠️  資料庫初始化失敗，改用回退模式');
  console.warn((error as Error).message);
  isDbConnected = false;
}

/**
 * 執行一個資料庫查詢；失敗時改用靜態資料。
 *
 * 這是整個回退機制的核心：連線池是延遲建立的，資料庫不通不會在啟動時
 * 報錯，而是在每一次查詢才丟出例外。所以判斷點必須在查詢當下。
 */
async function withFallback<T>(runQuery: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  if (!isDbConnected) {
    if (!isFallbackActive) throw new Error('資料庫不可用且回退資料未載入');
    return await fallback();
  }
  try {
    return await runQuery();
  } catch (error) {
    if (!isFallbackActive) throw error;
    console.warn('⚠️  查詢失敗，改用回退資料:', (error as Error).message);
    return await fallback();
  }
}

export { db, isDbConnected };



// ========== Categories ==========
export async function getAllCategories(): Promise<CategoryListItem[]> {
  return withFallback<CategoryListItem[]>(
    () => db.select().from(categories).orderBy(categories.name),
    () => getFallbackCategories()
  );
}

export async function getCategoryById(id: number) {
  return await withFallback(
    async () => {
      const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
      return result[0] || null;
    },
    () => getFallbackCategoryById(id)
  );
}

export async function createCategory(data: InsertCategory) {
  const result = await db.insert(categories).values(data);
  return result;
}

// ========== Products ==========
export async function getAllProducts(): Promise<ProductListItem[]> {
  return withFallback<ProductListItem[]>(
    () => db.select(publicProductColumns).from(products).orderBy(desc(products.createdAt)),
    async () => (await getFallbackProducts()).map(toPublicProduct)
  );
}

export async function getProductById(id: number): Promise<ProductListItem | null> {
  return await withFallback(
    async () => {
      const result = await db.select(publicProductColumns).from(products).where(eq(products.id, id)).limit(1);
      return result[0] || null;
    },
    async () => {
      const product = await getFallbackProductById(id);
      return product ? toPublicProduct(product) : null;
    }
  );
}

export async function getProductsByCategory(categoryId: number) {
  return await withFallback(
    () => db.select(publicProductColumns).from(products).where(eq(products.categoryId, categoryId)).orderBy(desc(products.createdAt)),
    async () => (await getFallbackProductsByCategory(categoryId)).map(toPublicProduct)
  );
}

/** 完整商品資料只供管理員路由使用。 */
export async function getAllProductsForAdmin(): Promise<Product[]> {
  return withFallback<Product[]>(
    () => db.select().from(products).orderBy(desc(products.createdAt)),
    async () => (await getFallbackProducts()) as unknown as Product[]
  );
}

export async function getProductByIdForAdmin(id: number): Promise<Product | null> {
  return await withFallback(
    async () => {
      const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
      return result[0] || null;
    },
    async () => (await getFallbackProductById(id)) as unknown as Product | null
  );
}

export async function getPublicAgProducts(): Promise<PublicAgProduct[]> {
  return withFallback(
    async () => {
      const rows = await db
        .select(publicAgProductColumns)
        .from(agProducts)
        .where(eq(agProducts.status, 'available'))
        .orderBy(agProducts.sortOrder, agProducts.id);
      return rows.length ? rows : getFallbackAgProducts();
    },
    async () => getFallbackAgProducts()
  );
}

export async function getAdminAgProducts(): Promise<AgProduct[]> {
  return db.select().from(agProducts).orderBy(agProducts.sortOrder, agProducts.id);
}

export async function importAgProducts(rows: InsertAgProduct[]): Promise<{ imported: number }> {
  if (!isDbConnected) throw new Error('資料庫目前不可用，無法匯入報價單');

  await db.transaction(async (tx: any) => {
    for (const row of rows) {
      const { barcode, createdAt: _createdAt, updatedAt: _updatedAt, ...updateValues } = row as any;
      await tx
        .insert(agProducts)
        .values({ ...row, barcode })
        .onDuplicateKeyUpdate({ set: updateValues });
    }
  });

  return { imported: rows.length };
}

export async function createProduct(data: InsertProduct) {
  const result = await db.insert(products).values({
    ...data,
    status: data.status || 'available',
    stock: data.stock || 1,
    lowStockThreshold: data.lowStockThreshold || 5,
    costJPY: data.costJPY || '0',
    priceUSD: data.priceUSD || '0',
    profitTWD: data.profitTWD || '0',
    exchangeRateJPYtoUSD: data.exchangeRateJPYtoUSD || '0.0075',
    exchangeRateUSDtoTWD: data.exchangeRateUSDtoTWD || '30',
    profitMargin: data.profitMargin || '2.0',
    internationalShippingCost: data.internationalShippingCost || '0',
  });
  return result;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const result = await db.update(products).set(data).where(eq(products.id, id));
  return result;
}

export async function deleteProduct(id: number) {
  const result = await db.delete(products).where(eq(products.id, id));
  return result;
}

/**
 * Get products with low stock
 */
export async function getLowStockProducts(threshold?: number) {
  const query = db.select().from(products).where(
    threshold ? sql`${products.stock} <= ${threshold}` : sql`${products.stock} <= ${products.lowStockThreshold}`
  );
  return await query.orderBy(products.stock);
}

/**
 * Search products by name or description
 */
export async function searchProducts(query: string) {
  const searchTerm = `%${query}%`;
  return await withFallback(
    () =>
      db
        .select(publicProductColumns)
        .from(products)
        .where(or(like(products.name, searchTerm), like(products.description, searchTerm)))
        .orderBy(desc(products.createdAt)),
    async () => (await searchFallbackProducts(query)).map(toPublicProduct)
  );
}

// ========== Suppliers ==========
export async function getAllSuppliers() {
  return await db.select().from(suppliers).orderBy(suppliers.name);
}

export async function getSupplierById(id: number) {
  const result = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1);
  return result[0] || null;
}

export async function createSupplier(data: InsertSupplier) {
  const result = await db.insert(suppliers).values(data);
  return result;
}

export async function updateSupplier(id: number, data: Partial<InsertSupplier>) {
  const result = await db.update(suppliers).set(data).where(eq(suppliers.id, id));
  return result;
}

export async function deleteSupplier(id: number) {
  const result = await db.delete(suppliers).where(eq(suppliers.id, id));
  return result;
}

// ========== Purchases ==========
export async function getAllPurchases() {
  return await db.select().from(purchases).orderBy(desc(purchases.purchaseDate));
}

export async function getPurchasesBySupplier(supplierId: number) {
  return await db.select().from(purchases).where(eq(purchases.supplierId, supplierId)).orderBy(desc(purchases.purchaseDate));
}

export async function createPurchase(data: InsertPurchase) {
  const result = await db.insert(purchases).values(data);
  return result;
}

export async function updatePurchase(id: number, data: Partial<InsertPurchase>) {
  const result = await db.update(purchases).set(data).where(eq(purchases.id, id));
  return result;
}

export async function deletePurchase(id: number) {
  const result = await db.delete(purchases).where(eq(purchases.id, id));
  return result;
}

// ========== Stock Management ==========
export async function updateProductStock(id: number, newStock: number) {
  const result = await db.update(products).set({ stock: newStock }).where(eq(products.id, id));
  return result;
}

export async function decreaseProductStock(id: number, quantity: number) {
  const product = await getProductById(id);
  if (!product) throw new Error('Product not found');
  const newStock = Math.max(0, product.stock - quantity);
  return updateProductStock(id, newStock);
}

export async function increaseProductStock(id: number, quantity: number) {
  const product = await getProductById(id);
  if (!product) throw new Error('Product not found');
  const newStock = product.stock + quantity;
  return updateProductStock(id, newStock);
}

export async function getProductsWithLowStock(threshold?: number) {
  return await db.select().from(products).where(
    threshold 
      ? lte(products.stock, threshold)
      : lte(products.stock, products.lowStockThreshold)
  );
}

// ========== Trips ==========
export async function getAllTrips(): Promise<Trip[]> {
  return await db.select().from(trips).orderBy(desc(trips.tripDate));
}

export async function getTripById(id: number) {
  const result = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return result[0] || null;
}

export async function createTrip(data: InsertTrip) {
  const result = await db.insert(trips).values(data);
  return result;
}

export async function updateTrip(id: number, data: Partial<InsertTrip>) {
  const result = await db.update(trips).set(data).where(eq(trips.id, id));
  return result;
}

export async function deleteTrip(id: number) {
  const result = await db.delete(trips).where(eq(trips.id, id));
  return result;
}

// ========== Trip Videos ==========
export async function getAllTripVideos(): Promise<TripVideo[]> {
  return await db.select().from(tripVideos).orderBy(desc(tripVideos.uploadedAt));
}

export async function getTripVideosByTripId(tripId: number) {
  return await db.select().from(tripVideos).where(eq(tripVideos.tripId, tripId)).orderBy(desc(tripVideos.uploadedAt));
}

export async function getLatestVideos(limit: number = 10): Promise<TripVideo[]> {
  return await db.select().from(tripVideos).orderBy(desc(tripVideos.uploadedAt)).limit(limit);
}

// ========== Shopping Cart ==========
export async function getCartItemsByUserId(userId: number) {
  return await db
    .select({
      id: cartItems.id,
      userId: cartItems.userId,
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      product: products,
      createdAt: cartItems.createdAt,
      updatedAt: cartItems.updatedAt,
    })
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, userId))
    .orderBy(desc(cartItems.createdAt));
}

export async function addToCart(data: InsertCartItem) {
  // Check if item already exists in cart
  const existing = await db
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, data.userId), eq(cartItems.productId, data.productId)))
    .limit(1);

  if (existing.length > 0) {
    // Update quantity
    const newQuantity = existing[0].quantity + (data.quantity || 1);
    await db
      .update(cartItems)
      .set({ quantity: newQuantity, updatedAt: new Date() })
      .where(eq(cartItems.id, existing[0].id));
    return existing[0].id;
  } else {
    // Insert new item
    const result = await db.insert(cartItems).values(data);
    return result[0].insertId;
  }
}

export async function updateCartItemQuantity(userId: number, id: number, quantity: number) {
  const result = await db
    .update(cartItems)
    .set({ quantity, updatedAt: new Date() })
    .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
  return result;
}

export async function removeCartItem(userId: number, id: number) {
  const result = await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, id), eq(cartItems.userId, userId)));
  return result;
}

export async function clearCart(userId: number) {
  const result = await db.delete(cartItems).where(eq(cartItems.userId, userId));
  return result;
}

// ========== Orders ==========
export async function createOrder(orderData: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]) {
  // Insert order
  const orderResult = await db.insert(orders).values(orderData);
  const orderId = orderResult[0].insertId;

  // Insert order items
  const itemsWithOrderId = items.map(item => ({ ...item, orderId }));
  await db.insert(orderItems).values(itemsWithOrderId);

  return orderId;
}

export async function getOrdersByUserId(userId: number) {
  return await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function getOrderById(id: number) {
  const order = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (order.length === 0) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  
  return {
    ...order[0],
    items,
  };
}

export async function getOrderByIdForUser(id: number, userId: number) {
  const order = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.userId, userId)))
    .limit(1);
  if (order.length === 0) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...order[0], items };
}

export async function getOrderByStripeSessionIdForUser(stripeSessionId: string, userId: number) {
  const order = await db
    .select()
    .from(orders)
    .where(and(eq(orders.stripeSessionId, stripeSessionId), eq(orders.userId, userId)))
    .limit(1);
  if (order.length === 0) return null;

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order[0].id));
  return { ...order[0], items };
}

export async function setOrderStripeSessionId(orderId: number, stripeSessionId: string) {
  await db.update(orders).set({ stripeSessionId }).where(eq(orders.id, orderId));
}

export async function markOrderPaidByStripeSessionId(stripeSessionId: string) {
  return db
    .update(orders)
    .set({ status: 'paid' })
    .where(
      and(
        eq(orders.stripeSessionId, stripeSessionId),
        eq(orders.status, 'pending')
      )
    );
}

export async function createTripVideo(data: InsertTripVideo) {
  const result = await db.insert(tripVideos).values(data);
  return result;
}

export async function deleteTripVideo(id: number) {
  const result = await db.delete(tripVideos).where(eq(tripVideos.id, id));
  return result;
}

// ========== Users ==========
export async function getUserById(id: number) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function isUserAdmin(userId: number) {
  const user = await getUserById(userId);
  return user?.role === 'admin';
}

export async function getUserByOpenId(openId: string) {
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] || null;
}

export async function upsertUser(data: { openId: string; name?: string | null; email?: string | null; loginMethod?: string | null; lastSignedIn?: Date }) {
  const existing = await getUserByOpenId(data.openId);
  
  if (existing) {
    // Update existing user
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.loginMethod !== undefined) updateData.loginMethod = data.loginMethod;
    if (data.lastSignedIn !== undefined) updateData.lastSignedIn = data.lastSignedIn;
    
    await db.update(users).set(updateData).where(eq(users.openId, data.openId));
    return await getUserByOpenId(data.openId);
  } else {
    // Insert new user
    await db.insert(users).values({
      openId: data.openId,
      name: data.name || null,
      email: data.email || null,
      loginMethod: data.loginMethod || null,
      role: 'user',
      lastSignedIn: data.lastSignedIn || new Date(),
    });
    return await getUserByOpenId(data.openId);
  }
}

// ========== Reviews ==========
export async function getReviewsByProductId(productId: number): Promise<Review[]> {
  return await db.select().from(reviews).where(eq(reviews.productId, productId)).orderBy(desc(reviews.createdAt));
}

export async function getReviewById(id: number) {
  const result = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return result[0] || null;
}

export async function createReview(data: InsertReview) {
  const result = await db.insert(reviews).values(data);
  return result;
}

export async function updateReview(id: number, data: Partial<InsertReview>) {
  const result = await db.update(reviews).set(data).where(eq(reviews.id, id));
  return result;
}

export async function deleteReview(id: number) {
  const result = await db.delete(reviews).where(eq(reviews.id, id));
  return result;
}

export async function getAverageRating(productId: number): Promise<number> {
  const result = await db.select({ avgRating: avg(reviews.rating) }).from(reviews).where(eq(reviews.productId, productId));
  return result[0]?.avgRating || 0;
}


// ========== Wishlists ==========
export async function getWishlistByUser(userId: number) {
  return await db.select().from(wishlists)
    .innerJoin(products, eq(wishlists.productId, products.id))
    .where(eq(wishlists.userId, userId))
    .orderBy(desc(wishlists.addedAt));
}

export async function addToWishlist(userId: number, productId: number) {
  const existing = await db.select().from(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.productId, productId)))
    .limit(1);
  
  if (existing.length > 0) {
    return existing[0];
  }
  
  const result = await db.insert(wishlists).values({ userId, productId });
  return result;
}

export async function removeFromWishlist(userId: number, productId: number) {
  const result = await db.delete(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.productId, productId)));
  return result;
}

export async function isInWishlist(userId: number, productId: number) {
  const result = await db.select().from(wishlists)
    .where(and(eq(wishlists.userId, userId), eq(wishlists.productId, productId)))
    .limit(1);
  return result.length > 0;
}

// ========== Financial Dashboard ==========
/**
 * Get today's revenue in USD
 */
export async function getTodayRevenue() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result: Order[] = await db.select().from(orders)
    .where(and(
      gte(orders.createdAt, today),
      lt(orders.createdAt, tomorrow),
      eq(orders.status, 'paid')
    ));

  const totalUSD = result.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  return {
    count: result.length,
    totalUSD: totalUSD / 100, // Convert cents to USD
    orders: result
  };
}

/**
 * Get this month's revenue
 */
export async function getMonthRevenue() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  lastDay.setHours(23, 59, 59, 999);

  const result: Order[] = await db.select().from(orders)
    .where(and(
      gte(orders.createdAt, firstDay),
      lte(orders.createdAt, lastDay),
      eq(orders.status, 'paid')
    ));

  const totalUSD = result.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  return {
    count: result.length,
    totalUSD: totalUSD / 100, // Convert cents to USD
    orders: result
  };
}

/**
 * Get all orders with financial details
 */
export async function getAllOrdersWithDetails() {
  const allOrders: Order[] = await db.select().from(orders).orderBy(desc(orders.createdAt));
  
  return Promise.all(allOrders.map(async (order) => {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    const user = await getUserById(order.userId);
    
    return {
      ...order,
      items,
      user,
      totalUSD: (order.totalAmount || 0) / 100,
    };
  }));
}

/**
 * Calculate financial metrics for dashboard
 */
/**
 * Update order status
 */
export async function updateOrderStatus(id: number, status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled') {
  const result = await db.update(orders).set({ status }).where(eq(orders.id, id));
  return result;
}

export async function getFinancialMetrics(exchangeRateUSDtoTWD: number = 30) {
  const todayData = await getTodayRevenue();
  const monthData = await getMonthRevenue();
  
  // Get all paid orders for total profit calculation
  const allPaidOrders: Order[] = await db.select().from(orders)
    .where(eq(orders.status, 'paid'));
  
  const totalRevenueUSD = allPaidOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0) / 100;
  
  return {
    today: {
      ordersCount: todayData.count,
      revenueUSD: todayData.totalUSD,
      revenueTWD: todayData.totalUSD * exchangeRateUSDtoTWD,
    },
    month: {
      ordersCount: monthData.count,
      revenueUSD: monthData.totalUSD,
      revenueTWD: monthData.totalUSD * exchangeRateUSDtoTWD,
    },
    total: {
      revenueUSD: totalRevenueUSD,
      revenueTWD: totalRevenueUSD * exchangeRateUSDtoTWD,
    }
  };
}


// ========== Users Management ==========
export async function getAllUsers() {
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: 'admin' | 'user') {
  const result = await db.update(users).set({ role }).where(eq(users.id, userId));
  return result;
}

/** 目前的管理員人數。用於判斷初次設定是否已完成。 */
export async function countAdmins(): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
  return rows.length;
}

// ========== 本站帳密登入 ==========
// authLocal.ts 需要下列函式，但先前並未實作，
// 導致 /api/auth/register 與 /api/auth/login 無法運作。

/** 最早註冊的使用者。初次設定時用來決定誰是管理員。 */
export async function getFirstUser() {
  const rows = await db.select().from(users).orderBy(users.id).limit(1);
  return rows[0] || null;
}

export async function getUserByEmail(email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] || null;
}

export async function createLocalUser(data: {
  openId: string;
  email: string;
  name: string | null;
  passwordHash: string;
}) {
  await db.insert(users).values({
    openId: data.openId,
    email: data.email,
    name: data.name,
    passwordHash: data.passwordHash,
    loginMethod: 'local',
  });
  const rows = await db.select().from(users).where(eq(users.openId, data.openId)).limit(1);
  return rows[0];
}


// ========== Announcements ==========
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const now = new Date();
  return await db.select().from(announcements)
    .where(
      and(
        eq(announcements.isActive, true),
        or(
          sql`${announcements.startDate} IS NULL`,
          lte(announcements.startDate, now)
        ),
        or(
          sql`${announcements.endDate} IS NULL`,
          gte(announcements.endDate, now)
        )
      )
    )
    .orderBy(desc(announcements.priority), desc(announcements.createdAt));
}

export async function getAllAnnouncements(): Promise<Announcement[]> {
  return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
}

export async function getAnnouncementById(id: number) {
  const result = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  return result[0] || null;
}

export async function createAnnouncement(data: InsertAnnouncement) {
  const result = await db.insert(announcements).values(data);
  return result;
}

export async function updateAnnouncement(id: number, data: Partial<InsertAnnouncement>) {
  const result = await db.update(announcements).set(data).where(eq(announcements.id, id));
  return result;
}

export async function deleteAnnouncement(id: number) {
  const result = await db.delete(announcements).where(eq(announcements.id, id));
  return result;
}

export async function toggleAnnouncementActive(id: number, isActive: boolean) {
  const result = await db.update(announcements).set({ isActive }).where(eq(announcements.id, id));
  return result;
}


// ========== API Keys ==========
export async function createApiKey(data: InsertApiKey) {
  const result = await db.insert(apiKeys).values(data);
  return result;
}

export async function getApiKeyByKey(key: string) {
  const result = await db.select().from(apiKeys).where(eq(apiKeys.key, key)).limit(1);
  return result[0] || null;
}

export async function getApiKeyById(id: number) {
  const result = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
  return result[0] || null;
}

export async function getAllApiKeys() {
  return await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
}

export async function updateApiKey(id: number, data: Partial<InsertApiKey>) {
  const result = await db.update(apiKeys).set(data).where(eq(apiKeys.id, id));
  return result;
}

export async function deleteApiKey(id: number) {
  const result = await db.delete(apiKeys).where(eq(apiKeys.id, id));
  return result;
}

export async function incrementApiKeyRequestCount(id: number) {
  const result = await db.update(apiKeys)
    .set({ 
      requestCount: sql`requestCount + 1`,
      lastUsedAt: new Date()
    })
    .where(eq(apiKeys.id, id));
  return result;
}

// ========== API Logs ==========
export async function createApiLog(data: InsertApiLog) {
  const result = await db.insert(apiLogs).values(data);
  return result;
}

export async function getApiLogsByKeyId(apiKeyId: number, limit: number = 100) {
  return await db.select()
    .from(apiLogs)
    .where(eq(apiLogs.apiKeyId, apiKeyId))
    .orderBy(desc(apiLogs.createdAt))
    .limit(limit);
}

export async function deleteOldApiLogs(daysOld: number = 30) {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const result = await db.delete(apiLogs).where(lt(apiLogs.createdAt, cutoffDate));
  return result;
}

export async function getApiLogs(limit: number = 20, offset: number = 0) {
  const logs: ApiLog[] = await db.select()
    .from(apiLogs)
    .orderBy(desc(apiLogs.createdAt))
    .limit(limit)
    .offset(offset);
  
  // 增強日誌信息，添加 API Key 名稱
  const enrichedLogs = await Promise.all(logs.map(async (log) => {
    const apiKey = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.id, log.apiKeyId))
      .limit(1);
    
    return {
      ...log,
      apiKeyName: apiKey[0]?.name || 'Unknown',
    };
  }));
  
  return enrichedLogs;
}

export async function getApiStats() {
  // 獲取今天的統計
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayLogs: ApiLog[] = await db.select()
    .from(apiLogs)
    .where(gte(apiLogs.createdAt, today));
  
  // 計算統計信息
  const totalRequests = todayLogs.length;
  const successfulRequests = todayLogs.filter(log => log.statusCode >= 200 && log.statusCode < 300).length;
  const failedRequests = todayLogs.filter(log => log.statusCode >= 400).length;
  
  // 統計上傳的商品數量（從 responseBody 中提取）
  let totalProductsUploaded = 0;
  for (const log of todayLogs) {
    if (log.responseBody && typeof log.responseBody === 'object' && 'productsCreated' in log.responseBody) {
      totalProductsUploaded += (log.responseBody.productsCreated as number) || 0;
    }
  }
  
  // 按 API Key 分組統計
  const byApiKey: Record<string, { requests: number; products: number }> = {};
  for (const log of todayLogs) {
    const apiKey = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.id, log.apiKeyId))
      .limit(1);
    
    const keyName = apiKey[0]?.name || `API Key ${log.apiKeyId}`;
    if (!byApiKey[keyName]) {
      byApiKey[keyName] = { requests: 0, products: 0 };
    }
    byApiKey[keyName].requests += 1;
    
    if (log.responseBody && typeof log.responseBody === 'object' && 'productsCreated' in log.responseBody) {
      byApiKey[keyName].products += (log.responseBody.productsCreated as number) || 0;
    }
  }
  
  return {
    date: today,
    totalRequests,
    successfulRequests,
    failedRequests,
    totalProductsUploaded,
    byApiKey,
  };
}
