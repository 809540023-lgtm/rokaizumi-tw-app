import { eq, desc, and, gte, lt, lte, avg, sql, or, ilike } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { categories, products, trips, tripVideos, users, cartItems, orders, orderItems, reviews, wishlists, suppliers, purchases, announcements, apiKeys, apiLogs, type InsertCategory, type InsertProduct, type InsertTrip, type InsertTripVideo, type InsertCartItem, type InsertOrder, type InsertOrderItem, type InsertReview, type InsertWishlist, type InsertSupplier, type InsertPurchase, type InsertAnnouncement, type InsertApiKey, type InsertApiLog } from '../drizzle/schema';
import { ENV } from './_core/env';

// Create database connection (PostgreSQL via postgres-js)
const client = postgres(ENV.databaseUrl, { max: 10 });
export const db = drizzle(client);

// ========== Categories ==========
export async function getAllCategories() {
  return await db.select().from(categories).orderBy(categories.name);
}

export async function getCategoryById(id: number) {
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result[0] || null;
}

export async function createCategory(data: InsertCategory) {
  const result = await db.insert(categories).values(data).returning();
  return result[0];
}

// ========== Products ==========
export async function getAllProducts() {
  return await db.select().from(products).orderBy(desc(products.createdAt));
}

export async function getProductById(id: number) {
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0] || null;
}

export async function getProductsByCategory(categoryId: number) {
  return await db.select().from(products).where(eq(products.categoryId, categoryId)).orderBy(desc(products.createdAt));
}

export async function createProduct(data: InsertProduct) {
  const result = await db.insert(products).values({
    ...data,
    status: data.status || 'available',
    stock: data.stock ?? 1,
    lowStockThreshold: data.lowStockThreshold ?? 5,
    costJPY: data.costJPY || '0',
    priceUSD: data.priceUSD || '0',
    profitTWD: data.profitTWD || '0',
    exchangeRateJPYtoUSD: data.exchangeRateJPYtoUSD || '0.0075',
    exchangeRateUSDtoTWD: data.exchangeRateUSDtoTWD || '30',
    profitMargin: data.profitMargin || '2.0',
    internationalShippingCost: data.internationalShippingCost || '0',
  }).returning();
  return result[0];
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
  return await db.select().from(products).where(
    or(
      ilike(products.name, searchTerm),
      ilike(products.description, searchTerm)
    )
  ).orderBy(desc(products.createdAt));
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
  const result = await db.insert(suppliers).values(data).returning();
  return result[0];
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
  const result = await db.insert(purchases).values(data).returning();
  return result[0];
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
export async function getAllTrips() {
  return await db.select().from(trips).orderBy(desc(trips.tripDate));
}

export async function getTripById(id: number) {
  const result = await db.select().from(trips).where(eq(trips.id, id)).limit(1);
  return result[0] || null;
}

export async function createTrip(data: InsertTrip) {
  const result = await db.insert(trips).values(data).returning();
  return result[0];
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
export async function getAllTripVideos() {
  return await db.select().from(tripVideos).orderBy(desc(tripVideos.uploadedAt));
}

export async function getTripVideosByTripId(tripId: number) {
  return await db.select().from(tripVideos).where(eq(tripVideos.tripId, tripId)).orderBy(desc(tripVideos.uploadedAt));
}

export async function getLatestVideos(limit: number = 10) {
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
    const result = await db.insert(cartItems).values(data).returning({ id: cartItems.id });
    return result[0].id;
  }
}

export async function updateCartItemQuantity(id: number, quantity: number) {
  const result = await db.update(cartItems).set({ quantity, updatedAt: new Date() }).where(eq(cartItems.id, id));
  return result;
}

export async function removeCartItem(id: number) {
  const result = await db.delete(cartItems).where(eq(cartItems.id, id));
  return result;
}

export async function clearCart(userId: number) {
  const result = await db.delete(cartItems).where(eq(cartItems.userId, userId));
  return result;
}

// ========== Orders ==========
export async function createOrder(orderData: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]) {
  // Insert order
  const orderResult = await db.insert(orders).values(orderData).returning({ id: orders.id });
  const orderId = orderResult[0].id;

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

export async function createTripVideo(data: InsertTripVideo) {
  const result = await db.insert(tripVideos).values(data).returning();
  return result[0];
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
export async function getReviewsByProductId(productId: number) {
  return await db.select().from(reviews).where(eq(reviews.productId, productId)).orderBy(desc(reviews.createdAt));
}

export async function getReviewById(id: number) {
  const result = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  return result[0] || null;
}

export async function createReview(data: InsertReview) {
  const result = await db.insert(reviews).values(data).returning();
  return result[0];
}

export async function updateReview(id: number, data: Partial<InsertReview>) {
  const result = await db.update(reviews).set(data).where(eq(reviews.id, id));
  return result;
}

export async function deleteReview(id: number) {
  const result = await db.delete(reviews).where(eq(reviews.id, id));
  return result;
}

export async function getAverageRating(productId: number) {
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

  const result = await db.insert(wishlists).values({ userId, productId }).returning();
  return result[0];
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

  const result = await db.select().from(orders)
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

  const result = await db.select().from(orders)
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
  const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));

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
  const allPaidOrders = await db.select().from(orders)
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

// ========== Announcements ==========
export async function getActiveAnnouncements() {
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

export async function getAllAnnouncements() {
  return await db.select().from(announcements).orderBy(desc(announcements.createdAt));
}

export async function getAnnouncementById(id: number) {
  const result = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  return result[0] || null;
}

export async function createAnnouncement(data: InsertAnnouncement) {
  const result = await db.insert(announcements).values(data).returning();
  return result[0];
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
  const result = await db.insert(apiKeys).values(data).returning();
  return result[0];
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
      requestCount: sql`${apiKeys.requestCount} + 1`,
      lastUsedAt: new Date()
    })
    .where(eq(apiKeys.id, id));
  return result;
}

// ========== API Logs ==========
export async function createApiLog(data: InsertApiLog) {
  const result = await db.insert(apiLogs).values(data).returning();
  return result[0];
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
  const logs = await db.select()
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

  const todayLogs = await db.select()
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
