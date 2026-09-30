import { date, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, json, boolean, customType } from "drizzle-orm/mysql-core";

/**
 * 圖片二進位欄位。
 *
 * 為什麼不是存 base64 進 TEXT？base64 會讓體積多 33%，而且 TEXT 上限只有 64KB。
 * LONGBLOB + mysql2 的原生 Buffer 是最直接的做法；TiDB 的 max_allowed_packet
 * 是 64MB，單張商品圖（壓縮後 < 200KB）綽綽有餘。
 */
const longblob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "longblob",
});

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
  /** 本站帳密登入用。走 OAuth 註冊的使用者為 null。 */
  passwordHash: varchar("passwordHash", { length: 255 }),
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
  // 商品識別與多語品名。原本資料表沒有這些欄位，改由資料庫供應商品後
  // JAN 條碼、品番與日英文品名會整批遺失。
  jan: varchar("jan", { length: 20 }),
  code: varchar("code", { length: 50 }),
  nameJa: varchar("nameJa", { length: 255 }),
  nameEn: varchar("nameEn", { length: 255 }),
  origin: varchar("origin", { length: 60 }),
  priceJpy: int("priceJpy"),
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

// 山田化學 /ag 專頁商品。批發價與箱規只透過管理員 API 回傳，
// 公開頁只取得商品資訊與 retailPriceTwd。
export const agProducts = mysqlTable("agProducts", {
  id: int("id").autoincrement().primaryKey(),
  barcode: varchar("barcode", { length: 20 }).notNull().unique(),
  catalog: varchar("catalog", { length: 50 }),
  itemNo: varchar("itemNo", { length: 50 }),
  nameJa: varchar("nameJa", { length: 255 }).notNull(),
  nameEn: varchar("nameEn", { length: 255 }),
  countryOrigin: varchar("countryOrigin", { length: 60 }),
  innerPack: int("innerPack"),
  piecesPerCarton: int("piecesPerCarton"),
  wholesaleFobJpy: decimal("wholesaleFobJpy", { precision: 10, scale: 2 }),
  cubicMeters: decimal("cubicMeters", { precision: 10, scale: 3 }),
  grossWeightKg: decimal("grossWeightKg", { precision: 10, scale: 2 }),
  retailPriceTwd: int("retailPriceTwd").default(22).notNull(),
  imageUrl: text("imageUrl"),
  images: json("images").$type<string[]>(),
  size: varchar("size", { length: 120 }),
  capacity: varchar("capacity", { length: 120 }),
  material: text("material"),
  assortment: text("assortment"),
  status: mysqlEnum("status", ["available", "discontinued"]).default("available").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  sourceFile: varchar("sourceFile", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AgProduct = typeof agProducts.$inferSelect;
export type InsertAgProduct = typeof agProducts.$inferInsert;

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
  stripeSessionId: varchar("stripeSessionId", { length: 255 }).unique(),
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

export type B2bInquiry = typeof b2bInquiries.$inferSelect;
export type InsertB2bInquiry = typeof b2bInquiries.$inferInsert;

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

/* ==================================================================
 * Univer Office Kit — 線上表格 / 文檔
 *
 * 兩張表：主檔（最新內容）與版本紀錄。
 * 內容存的是 Univer 的快照 JSON（IWorkbookData / IDocumentData），
 * 不是渲染後的檔案，因此還原後仍可繼續編輯（公式、樣式都在）。
 *
 * 注意：documentId 刻意不加外鍵約束。
 * 這裡的完整性由應用層維護（刪除主檔時同步刪版本），
 * 避免在 TiDB 上多一個可能讓整道 CREATE TABLE 失敗的變數。
 * ================================================================== */

export const officeDocuments = mysqlTable("office_documents", {
  /** 由伺服器產生的 uuid，前端也會先用同一個 id 做 autosave */
  id: varchar("id", { length: 40 }).primaryKey(),
  ownerId: int("ownerId"),
  title: varchar("title", { length: 255 }).notNull(),
  kind: mysqlEnum("kind", ["sheet", "doc"]).notNull(),
  templateKey: varchar("templateKey", { length: 80 }),
  /** 目前版本號，每次「另存版本」+1 */
  currentVersion: int("currentVersion").notNull().default(1),
  /** 最新內容快照 */
  content: json("content").$type<unknown>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OfficeDocumentRow = typeof officeDocuments.$inferSelect;
export type InsertOfficeDocument = typeof officeDocuments.$inferInsert;

export const officeDocumentVersions = mysqlTable("office_document_versions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: varchar("documentId", { length: 40 }).notNull(),
  version: int("version").notNull(),
  content: json("content").notNull().$type<unknown>(),
  note: varchar("note", { length: 255 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type OfficeDocumentVersionRow = typeof officeDocumentVersions.$inferSelect;
export type InsertOfficeDocumentVersion = typeof officeDocumentVersions.$inferInsert;

/* ==================================================================
 * 面膜批發自動化（日本大阪難波 → 台灣）
 *
 * 流程：Google 雲端照片 → AI 辨識 → 法遵檢核 → 文案 → 定價 → 上架成正式商品
 *
 * 為什麼獨立成 masks 而不是直接塞進 products？
 *   products 是前台在賣的商品（1619 筆），欄位是「已經決定要賣」的樣子。
 *   masks 是「還在處理中」的工作檔：AI 辨識結果、法遵報告、成本推估都會一直變，
 *   而且可能有多張照片與多次執行紀錄。等定案後才寫進 products 並記下 productId。
 * ================================================================== */

export const masks = mysqlTable("masks", {
  /** 前端 / 本機代理產生的 uuid，用來做幂等上傳 */
  id: varchar("id", { length: 40 }).primaryKey(),
  sku: varchar("sku", { length: 40 }).notNull().unique(),
  status: mysqlEnum("status", [
    "draft",
    "analyzed",
    "compliance_blocked",
    "ready",
    "published",
    "archived",
  ])
    .notNull()
    .default("draft"),

  // 商品基本資料（多數由 AI 從照片讀出，可人工覆寫）
  brand: varchar("brand", { length: 120 }),
  nameZh: varchar("nameZh", { length: 255 }).notNull().default("（待 AI 辨識命名）"),
  nameJa: varchar("nameJa", { length: 255 }),
  series: varchar("series", { length: 120 }),
  barcode: varchar("barcode", { length: 20 }),
  volumeMl: int("volumeMl"),
  sheetsPerPack: int("sheetsPerPack"),
  piecesPerBox: int("piecesPerBox"),
  shelfLifeMonths: int("shelfLifeMonths"),

  // 進貨條件
  supplierJpy: int("supplierJpy"),
  moq: int("moq").default(12),
  supplierName: varchar("supplierName", { length: 120 }),
  /** 可上架庫存，上架時會寫進 products.stock */
  stock: int("stock").default(30),

  // 法規
  regulatoryType: mysqlEnum("regulatoryType", ["general", "specific_purpose"])
    .notNull()
    .default("general"),
  registrationNo: varchar("registrationNo", { length: 80 }),
  /**
   * 中文標示第 6 項：製造日期或批號。
   * 這個只能在收貨時逐批抄，AI 讀照片不可靠，所以獨立成欄位讓人工填。
   */
  manufactureDate: varchar("manufactureDate", { length: 60 }),
  /**
   * 中文標示第 8 項：在台進口商名稱、地址、電話。
   * 通常整批商品都一樣，填一次就可以重複套用。
   */
  importerInfo: varchar("importerInfo", { length: 255 }),

  // AI 辨識與產出（整包存 JSON，欄位還在演進時不用一直改資料表）
  attributes: json("attributes").$type<Record<string, unknown>>(),
  ingredients: json("ingredients").$type<string[]>(),
  websiteCopy: json("websiteCopy").$type<Record<string, unknown>>(),
  wholesaleCopy: json("wholesaleCopy").$type<Record<string, unknown>>(),
  costBreakdown: json("costBreakdown").$type<Record<string, unknown>>(),

  // 定價（台灣端）
  unitCostTwd: decimal("unitCostTwd", { precision: 10, scale: 2 }),
  wholesaleTwd: int("wholesaleTwd"),
  retailTwd: int("retailTwd"),
  grossMarginPct: decimal("grossMarginPct", { precision: 6, scale: 2 }),

  // 法遵
  complianceStatus: mysqlEnum("complianceStatus", ["pending", "pass", "warn", "blocked"])
    .notNull()
    .default("pending"),
  complianceReport: json("complianceReport").$type<Record<string, unknown>>(),

  /** 上架後對應的 products.id */
  productId: int("productId"),

  /** 來源：Google 雲端資料夾與檔名，方便回溯這批照片從哪來 */
  sourceFolder: varchar("sourceFolder", { length: 255 }),
  sourceFiles: json("sourceFiles").$type<string[]>(),
  note: text("note"),

  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaskRow = typeof masks.$inferSelect;
export type InsertMask = typeof masks.$inferInsert;

/** 面膜照片（二進位直接存資料庫，沒有 S3 也能運作） */
export const maskPhotos = mysqlTable("maskPhotos", {
  id: int("id").autoincrement().primaryKey(),
  maskId: varchar("maskId", { length: 40 }).notNull(),
  role: mysqlEnum("role", ["front", "back", "box", "texture", "detail"]).notNull().default("front"),
  mimeType: varchar("mimeType", { length: 40 }).notNull().default("image/jpeg"),
  data: longblob("data").notNull(),
  byteSize: int("byteSize").notNull().default(0),
  width: int("width"),
  height: int("height"),
  /** 來源檔名（雲端上的檔名），重複上傳時用來判斷是否同一張 */
  sourceFile: varchar("sourceFile", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MaskPhotoRow = typeof maskPhotos.$inferSelect;

/** 每個階段的執行紀錄，出問題時可回溯是哪一步、第幾次嘗試失敗 */
export const maskRuns = mysqlTable("maskRuns", {
  id: int("id").autoincrement().primaryKey(),
  maskId: varchar("maskId", { length: 40 }),
  stage: varchar("stage", { length: 40 }).notNull(),
  status: mysqlEnum("status", ["success", "failed", "skipped"]).notNull(),
  attempt: int("attempt").notNull().default(1),
  input: json("input").$type<unknown>(),
  output: json("output").$type<unknown>(),
  error: text("error"),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MaskRunRow = typeof maskRuns.$inferSelect;

/** 階段待辦提醒（取貨、集貨、報關、出貨、法遵月檢…） */
export const maskTasks = mysqlTable("maskTasks", {
  id: int("id").autoincrement().primaryKey(),
  workflowKey: varchar("workflowKey", { length: 60 }),
  title: varchar("title", { length: 200 }).notNull(),
  detail: text("detail"),
  owner: varchar("owner", { length: 60 }),
  dueAt: timestamp("dueAt"),
  status: mysqlEnum("status", ["pending", "notified", "done", "skipped"]).notNull().default("pending"),
  /** 同一個時間點的工作只會有一筆，重複同步不會灌爆 */
  dedupeKey: varchar("dedupeKey", { length: 160 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaskTaskRow = typeof maskTasks.$inferSelect;
