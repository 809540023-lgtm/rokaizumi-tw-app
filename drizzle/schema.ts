import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  real,
  json,
  date,
} from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 16 }).$type<"user" | "admin">().default("user").notNull(),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 20 }),
  country: varchar("country", { length: 100 }),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Product categories table
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  icon: varchar("icon", { length: 32 }),
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  nameJa: varchar("nameJa", { length: 255 }),
  description: text("description"),
  sku: varchar("sku", { length: 64 }).unique(),
  brand: varchar("brand", { length: 255 }),
  price: integer("price").notNull(),
  originalPrice: integer("originalPrice"),
  categoryId: integer("categoryId").notNull().references(() => categories.id),
  imageUrl: text("imageUrl"),
  images: json("images").$type<string[]>(),
  status: varchar("status", { length: 16 }).$type<"available" | "sold" | "reserved">().default("available").notNull(),
  specifications: text("specifications"),
  stock: integer("stock").default(0).notNull(),
  lowStockThreshold: integer("lowStockThreshold").default(5).notNull(),
  salesCount: integer("salesCount").default(0).notNull(),
  rating: real("rating").default(0).notNull(),
  reviewCount: integer("reviewCount").default(0).notNull(),
  isTaxExempt: boolean("isTaxExempt").default(false).notNull(),
  // Multi-currency pricing fields
  costJPY: numeric("costJPY", { precision: 12, scale: 2 }).default("0").notNull(),
  priceUSD: numeric("priceUSD", { precision: 12, scale: 2 }).default("0").notNull(),
  profitTWD: numeric("profitTWD", { precision: 12, scale: 2 }).default("0").notNull(),
  exchangeRateJPYtoUSD: numeric("exchangeRateJPYtoUSD", { precision: 10, scale: 6 }).default("0.0075").notNull(),
  exchangeRateUSDtoTWD: numeric("exchangeRateUSDtoTWD", { precision: 10, scale: 2 }).default("30").notNull(),
  lastRateUpdateAt: timestamp("lastRateUpdateAt").defaultNow().notNull(),
  profitMargin: numeric("profitMargin", { precision: 5, scale: 2 }).default("2.0").notNull(),
  internationalShippingCost: numeric("internationalShippingCost", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// Japan procurement trips table
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  tripDate: date("tripDate", { mode: "string" }).notNull(),
  location: varchar("location", { length: 255 }).notNull(),
  status: varchar("status", { length: 16 }).$type<"scheduled" | "ongoing" | "completed">().default("scheduled").notNull(),
  notes: text("notes"),
  createdByAdminId: integer("createdByAdminId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Trip = typeof trips.$inferSelect;
export type InsertTrip = typeof trips.$inferInsert;

// Trip videos table
export const tripVideos = pgTable("tripVideos", {
  id: serial("id").primaryKey(),
  tripId: integer("tripId").notNull().references(() => trips.id),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: text("videoUrl").notNull(),
  thumbnailUrl: text("thumbnailUrl").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type TripVideo = typeof tripVideos.$inferSelect;
export type InsertTripVideo = typeof tripVideos.$inferInsert;

// Shopping cart table
export const cartItems = pgTable("cartItems", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  productId: integer("productId").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = typeof cartItems.$inferInsert;

// Orders table
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  totalAmount: integer("totalAmount").notNull(),
  status: varchar("status", { length: 16 }).$type<"pending" | "paid" | "shipped" | "completed" | "cancelled">().default("pending").notNull(),
  shippingAddress: text("shippingAddress").notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 50 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

// Order items table
export const orderItems = pgTable("orderItems", {
  id: serial("id").primaryKey(),
  orderId: integer("orderId").notNull().references(() => orders.id),
  productId: integer("productId").notNull().references(() => products.id),
  productName: varchar("productName", { length: 255 }).notNull(),
  productPrice: integer("productPrice").notNull(),
  quantity: integer("quantity").notNull(),
  subtotal: integer("subtotal").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = typeof orderItems.$inferInsert;

// Product reviews table
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id),
  userId: integer("userId").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

// Wishlist table
export const wishlists = pgTable("wishlists", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type Wishlist = typeof wishlists.$inferSelect;
export type InsertWishlist = typeof wishlists.$inferInsert;

// Suppliers table (進貨廠商)
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 10 }).unique(),
  contactPerson: varchar("contactPerson", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// Purchase records table (進貨記錄)
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  productId: integer("productId").notNull().references(() => products.id, { onDelete: "cascade" }),
  supplierId: integer("supplierId").notNull().references(() => suppliers.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  purchasePrice: numeric("purchasePrice", { precision: 10, scale: 2 }).notNull(),
  totalCost: numeric("totalCost", { precision: 12, scale: 2 }).notNull(),
  purchaseDate: timestamp("purchaseDate").defaultNow().notNull(),
  deliveryDate: timestamp("deliveryDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = typeof purchases.$inferInsert;

// Announcements table for marquee/banner messages
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  contentZh: text("contentZh").notNull(),
  contentEn: text("contentEn"),
  contentJa: text("contentJa"),
  isActive: boolean("isActive").default(true).notNull(),
  priority: integer("priority").default(0).notNull(),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = typeof announcements.$inferInsert;

// API Keys table for external integrations (e.g., OpenClaw)
export const apiKeys = pgTable("apiKeys", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  ipWhitelist: text("ipWhitelist"),
  rateLimit: integer("rateLimit").default(1000).notNull(),
  rateLimitWindow: integer("rateLimitWindow").default(3600).notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  requestCount: integer("requestCount").default(0).notNull(),
  createdByAdminId: integer("createdByAdminId").notNull().references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = typeof apiKeys.$inferInsert;

// API request logs for audit and debugging
export const apiLogs = pgTable("apiLogs", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("apiKeyId").notNull().references(() => apiKeys.id),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  statusCode: integer("statusCode").notNull(),
  requestBody: json("requestBody").$type<Record<string, any>>(),
  responseBody: json("responseBody").$type<Record<string, any>>(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  errorMessage: text("errorMessage"),
  executionTimeMs: integer("executionTimeMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApiLog = typeof apiLogs.$inferSelect;
export type InsertApiLog = typeof apiLogs.$inferInsert;

// ============== v4 新增表 ==============

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  source: varchar("source", { length: 50 }).default("web"),
  couponCode: varchar("coupon_code", { length: 50 }),
  unsubscribedAt: timestamp("unsubscribed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type InsertNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;

export const b2bInquiries = pgTable("b2b_inquiries", {
  id: serial("id").primaryKey(),
  company: varchar("company", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  type: varchar("type", { length: 50 }).notNull(),
  monthlyBudget: varchar("monthly_budget", { length: 50 }).notNull(),
  message: text("message"),
  status: varchar("status", { length: 20 }).default("new").notNull(),
  internalNote: text("internal_note"),
  assignedTo: integer("assigned_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type B2BInquiry = typeof b2bInquiries.$inferSelect;
export type InsertB2BInquiry = typeof b2bInquiries.$inferInsert;

export const productReviews = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  userId: integer("user_id").notNull(),
  rating: integer("rating").notNull(),
  title: varchar("title", { length: 255 }),
  body: text("body").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ProductReview = typeof productReviews.$inferSelect;
export type InsertProductReview = typeof productReviews.$inferInsert;
