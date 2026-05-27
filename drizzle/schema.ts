import { date, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  // Personal profile fields
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Product categories table
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// Products table
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: int("price").notNull(),
  categoryId: int("categoryId").notNull().references(() => categories.id),
  imageUrl: text("imageUrl"),
  images: json("images").$type<string[]>(),
  status: mysqlEnum("status", ["available", "sold", "reserved"]).default("available").notNull(),
  specifications: text("specifications"),
  stock: int("stock").default(0).notNull(),
  lowStockThreshold: int("lowStockThreshold").default(5).notNull(),
  // Multi-currency pricing fields
  costJPY: decimal("costJPY", { precision: 12, scale: 2 }).default("0").notNull(),
  priceUSD: decimal("priceUSD", { precision: 12, scale: 2 }).default("0").notNull(),
  profitTWD: decimal("profitTWD", { precision: 12, scale: 2 }).default("0").notNull(),
  // Exchange rate tracking
  exchangeRateJPYtoUSD: decimal("exchangeRateJPYtoUSD", { precision: 10, scale: 6 }).default("0.0075").notNull(),
  exchangeRateUSDtoTWD: decimal("exchangeRateUSDtoTWD", { precision: 10, scale: 2 }).default("30").notNull(),
  lastRateUpdateAt: timestamp("lastRateUpdateAt").defaultNow().notNull(),
  // Profit margin settings
  profitMargin: decimal("profitMargin", { precision: 5, scale: 2 }).default("2.0").notNull(),
  internationalShippingCost: decimal("internationalShippingCost", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// Japan procurement trips table
export const trips = mysqlTable("trips", {
  id: int("id").autoincrement().primaryKey(),
  tripDate: date("tripDate", { mode: "string" }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["scheduled", "ongoing", "completed"]).default("scheduled").notNull(),
  notes: text("notes"),
  createdByAdminId: int("createdByAdminId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

// Trip videos table
export const tripVideos = mysqlTable("tripVideos", {
  id: int("id").autoincrement().primaryKey(),
  tripId: int("tripId").notNull().references(() => trips.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: text("videoUrl").notNull(),
  thumbnailUrl: text("thumbnailUrl").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type TripVideo = typeof tripVideos.$inferSelect;
export type InsertTripVideo = typeof tripVideos.$inferInsert;

// Shopping cart table
export const cartItems = mysqlTable("cartItems", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  productId: int("productId").notNull().references(() => products.id),
  quantity: int("quantity").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// Orders table
export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id),
  totalAmount: int("totalAmount").notNull(),
  status: mysqlEnum("status", ["pending", "paid", "shipped", "completed", "cancelled"]).default("pending").notNull(),
  shippingAddress: text("shippingAddress").notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// Order items table
export const orderItems = mysqlTable("orderItems", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull().references(() => orders.id),
  productId: int("productId").notNull().references(() => products.id),
  productName: varchar("productName", { length: 255 }).notNull(),
  productPrice: int("productPrice").notNull(),
  quantity: int("quantity").notNull(),
  subtotal: int("subtotal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// Product reviews table
export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id),
  userId: int("userId").notNull().references(() => users.id),
  rating: int("rating").notNull(), // 1-5 stars
  title: varchar("title", { length: 255 }).notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

// Wishlist table
export const wishlists = mysqlTable("wishlists", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type Wishlist = typeof wishlists.$inferSelect;
export type InsertWishlist = typeof wishlists.$inferInsert;

// Suppliers table (進貨廠商)
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).unique(), // 廠商編號（例如：001, 002, 003...010）
  contactPerson: varchar("contactPerson", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// Purchase records table (進貨記錄)
export const purchases = mysqlTable("purchases", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  supplierId: int("supplierId").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  quantity: int("quantity").notNull(),
  purchasePrice: decimal("purchasePrice", { precision: 10, scale: 2 }).notNull(),
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }).notNull(),
  purchaseDate: timestamp("purchaseDate").defaultNow().notNull(),
  deliveryDate: timestamp("deliveryDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = typeof purchases.$inferInsert;

// Announcements table for marquee/banner messages
export const announcements = mysqlTable("announcements", {
  id: int("id").autoincrement().primaryKey(),
  // Multi-language content
  contentZh: text("contentZh").notNull(), // Chinese content
  contentEn: text("contentEn"), // English content (optional)
  contentJa: text("contentJa"), // Japanese content (optional)
  // Display settings
  isActive: boolean("isActive").default(true).notNull(),
  priority: int("priority").default(0).notNull(), // Higher priority shows first
  // Scheduling
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;

// API Keys table for external integrations (e.g., OpenClaw)
export const apiKeys = mysqlTable("apiKeys", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // e.g., "OpenClaw Integration"
  key: varchar("key", { length: 64 }).notNull().unique(), // Hashed API key
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  // IP whitelist (comma-separated IPs, empty means allow all)
  ipWhitelist: text("ipWhitelist"),
  // Rate limiting
  rateLimit: int("rateLimit").default(1000).notNull(), // requests per hour
  rateLimitWindow: int("rateLimitWindow").default(3600).notNull(), // in seconds
  // Usage tracking
  lastUsedAt: timestamp("lastUsedAt"),
  requestCount: int("requestCount").default(0).notNull(),
  // Metadata
  createdByAdminId: int("createdByAdminId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// API request logs for audit and debugging
export const apiLogs = mysqlTable("apiLogs", {
  id: int("id").autoincrement().primaryKey(),
  apiKeyId: int("apiKeyId").notNull().references(() => apiKeys.id),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(), // GET, POST, etc.
  statusCode: int("statusCode").notNull(),
  requestBody: json("requestBody").$type<Record<string, any>>(),
  responseBody: json("responseBody").$type<Record<string, any>>(),
  ipAddress: varchar("ipAddress", { length: 45 }), // Support IPv4 and IPv6
  errorMessage: text("errorMessage"),
  executionTimeMs: int("executionTimeMs"), // Execution time in milliseconds
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiLog = typeof apiLogs.$inferSelect;
export type InsertApiLog = typeof apiLogs.$inferInsert;

// ============== v4 新增表 ==============

export const newsletterSubscribers = mysqlTable("newsletter_subscribers", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  source: varchar("source", { length: 50 }).default("web"),
  couponCode: varchar("coupon_code", { length: 50 }),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;

export const b2bInquiries = mysqlTable("b2b_inquiries", {
  id: int("id").autoincrement().primaryKey(),
  company: varchar("company", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  type: varchar("type", { length: 50 }).notNull(),
  monthlyBudget: varchar("monthly_budget", { length: 50 }).notNull(),
  message: text("message"),
  status: varchar("status", { length: 20 }).default("new").notNull(),
  internalNote: text("internal_note"),
  assignedTo: int("assigned_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type B2BInquiry = typeof b2bInquiries.$inferSelect;
export type InsertB2BInquiry = typeof b2bInquiries.$inferInsert;

export const productReviews = mysqlTable("product_reviews", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  userId: int("user_id").notNull(),
  rating: int("rating").notNull(),
  title: varchar("title", { length: 255 }),
  body: text("body").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProductReview = typeof productReviews.$inferSelect;
export type InsertProductReview = typeof productReviews.$inferInsert;
