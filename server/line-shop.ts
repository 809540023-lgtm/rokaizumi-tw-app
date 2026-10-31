import express, { Router, type Request, type Response } from "express";
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { markCandleOrderPaidByStripeSessionId } from "./candle-orders";
import { canRemind, reminderText } from "./line-shop-reminders";
import seed from "./public/line-shop-catalog.json";
import { sdk } from "./_core/sdk";
import { getSessionCookieOptions } from "./_core/cookies";
import { hashPassword, verifyPassword } from "./_core/password";
import {
  ShopInputError,
  resolveShopItems,
  shippingQuote,
  orderShippingTwd,
  validPaidSession,
  TERMS_VERSION,
  type ShopItem,
  type ShopProduct,
} from "./line-shop-pricing";

const router = Router();
const origin = () => process.env.LINE_SHOP_ORIGIN || "https://rokaizumi-tw.jp";
// The shop is also reachable on the Render host and on www before the
// canonical redirect, so those same-site origins must be accepted too.
const shopOrigins = () => {
  const allowed = new Set([origin().replace(/\/+$/, "")]);
  try {
    const url = new URL(origin());
    allowed.add(
      `${url.protocol}//${url.hostname.startsWith("www.") ? url.hostname.slice(4) : `www.${url.hostname}`}`
    );
  } catch {}
  if (process.env.RENDER_EXTERNAL_HOSTNAME)
    allowed.add(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`);
  return allowed;
};
const requestOrigin = (req: Request) =>
  req.get("origin") ||
  (req.get("referer") ? new URL(req.get("referer")!).origin : "");
const live = () => process.env.LINE_SHOP_MODE === "live";
const key = () => process.env.LINE_SHOP_STRIPE_SECRET_KEY || "";
const configured = () =>
  process.env.LINE_SHOP_ENABLED === "true" &&
  Boolean(
    process.env.DATABASE_URL &&
      process.env.LINE_SHOP_STRIPE_WEBHOOK_SECRET &&
      new RegExp("^(sk|rk)_" + (live() ? "live" : "test") + "_").test(key()) &&
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const customerDescriptions = new Map(seed.map(product => [product.id, product.desc]));
const parsed = <T>(value: string | T): T =>
  typeof value === "string" ? JSON.parse(value) : value;
const excluded = new Set([
  "M041",
  "M043",
  "M046",
  "M050",
  "M063",
  "M065",
  "M067",
  "M070",
  "S013",
  ...[
    "93417",
    "587680",
    "71543",
    "96692",
    "76041",
    "58418",
    "516143",
    "87701",
    "511347",
    "76493",
    "93210",
    "10381",
    "63068",
  ].map(id => "COSTCO-" + id),
]);
const STOCK_RESET_MIGRATION = "2026-10-14-stock-10";
const SELF_HOSTED_IMAGES_MIGRATION = "2026-10-30-self-hosted-images";
let pool: Pool | undefined;
let initialization: Promise<void> | undefined;
async function database() {
  if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
  if (!pool) {
    const hostname = new URL(process.env.DATABASE_URL).hostname;
    const internal =
      /^(localhost|127\.0\.0\.1|10\..*|192\.168\..*|172\.(1[6-9]|2\d|3[01])\..*)$/.test(
        hostname
      );
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      connectionLimit: 5,
      ...(process.env.DATABASE_SSL === "false" ||
      (!process.env.DATABASE_SSL && internal)
        ? {}
        : { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }),
    });
  }
  initialization ??= initialize(pool).catch(e => {
    initialization = undefined;
    throw e;
  });
  await initialization;
  return pool;
}
async function initialize(db: Pool) {
  await db.query(
    `CREATE TABLE IF NOT EXISTS line_shop_products (id VARCHAR(40) PRIMARY KEY, data_json JSON NOT NULL, stock INT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE)`
  );
  await ensureProductContentColumn(db);
  await db.query(
    `CREATE TABLE IF NOT EXISTS line_shop_orders (id VARCHAR(40) PRIMARY KEY, request_key VARCHAR(64) UNIQUE NOT NULL, request_hash CHAR(64) NOT NULL, token_hash CHAR(64) NOT NULL, items_json JSON NOT NULL, customer_json JSON NOT NULL, subtotal INT NOT NULL, shipping INT NULL, ems_jpy INT NULL, weight_grams INT NULL, mode VARCHAR(10) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'awaiting_quote', session_id VARCHAR(255) UNIQUE NULL, payment_intent VARCHAR(255) NULL, checkout_url TEXT NULL, reserved BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS line_shop_mail (id BIGINT AUTO_INCREMENT PRIMARY KEY, order_id VARCHAR(40) NOT NULL, kind VARCHAR(30) NOT NULL, recipient VARCHAR(320) NOT NULL, subject VARCHAR(250) NOT NULL, body TEXT NOT NULL, state VARCHAR(20) NOT NULL DEFAULT 'pending', message_id VARCHAR(255) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY dedupe (order_id,kind))`
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS line_shop_limits (bucket CHAR(64) PRIMARY KEY, hits INT NOT NULL, expires_at BIGINT NOT NULL)`
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS line_shop_fulfillment (order_id VARCHAR(40) PRIMARY KEY, status VARCHAR(20) NOT NULL, tracking_number VARCHAR(100) NOT NULL DEFAULT '', shipped_at TIMESTAMP NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS line_shop_images (id CHAR(64) PRIMARY KEY, mime VARCHAR(40) NOT NULL, bytes MEDIUMBLOB NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS line_shop_migrations (migration_key VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
  await db.query(
    `CREATE TABLE IF NOT EXISTS line_shop_stores (
      id VARCHAR(40) PRIMARY KEY,
      owner_user_id INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      contact_name VARCHAR(100) NOT NULL,
      phone VARCHAR(40) NOT NULL,
      email VARCHAR(320) NOT NULL,
      line_id VARCHAR(100) NOT NULL DEFAULT '',
      address VARCHAR(500) NOT NULL DEFAULT '',
      tax_id VARCHAR(20) NOT NULL DEFAULT '',
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY store_owner (owner_user_id)
    )`
  );
  await ensureStoreColumn(db);
  const products = seed.filter(p => !excluded.has(p.id));
  if (products.length)
    await db.query(
      "INSERT IGNORE INTO line_shop_products (id,data_json,stock) VALUES ?",
      [products.map(p => [p.id, JSON.stringify(p), p.stock])]
    );
  await runShopMigrations(db);
}
// 後台改過的品名、說明、圖片等放在 admin_json，只有被改到的欄位才蓋掉目錄檔，
// 沒改的仍跟著 line-shop-catalog.json 走。
const CONTENT_FIELDS = ["name", "desc", "spec", "jp", "tag", "image"] as const;
type ProductContent = Partial<Record<(typeof CONTENT_FIELDS)[number], string>>;
const CONTENT_LIMITS: Record<(typeof CONTENT_FIELDS)[number], [string, number]> =
  {
    name: ["品名", 120],
    desc: ["說明", 1000],
    spec: ["規格", 60],
    jp: ["日文名", 120],
    tag: ["標籤", 40],
    image: ["圖片網址", 500],
  };
// 後台上傳的商品圖存進資料庫（Render 的檔案系統重開就清空，不能存檔案），
// 由 GET /img/:file 提供。檔名是內容雜湊，換圖就換網址，所以可以永久快取。
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
// 用檔頭確認副檔名不是隨便填的，免得把非圖片內容當成 image/* 送出去。
function imageMime(bytes: Buffer): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes.length > 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (
    bytes.length > 12 &&
    bytes.subarray(0, 4).toString("latin1") === "RIFF" &&
    bytes.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return "image/webp";
  if (bytes.length > 6 && bytes.subarray(0, 4).toString("latin1") === "GIF8")
    return "image/gif";
  return null;
}
function contentText(field: (typeof CONTENT_FIELDS)[number], value: unknown) {
  const [label, max] = CONTENT_LIMITS[field];
  if (typeof value !== "string")
    throw new ShopInputError(`${label}格式不正確`);
  const text = value.trim();
  if (text.length > max) throw new ShopInputError(`${label}不得超過 ${max} 字`);
  if (field === "image" && text && !/^https:\/\//.test(text) && !/^\/(?!\/)/.test(text))
    throw new ShopInputError("圖片網址需以 https:// 或 / 開頭");
  return text;
}
export const MAX_PRODUCT_PRICE_TWD = 100000;
export const MAX_PRODUCT_STOCK = 100000;
// 驗圖並算出存放位置。後台上傳與 Telegram 機器人共用同一套規則，
// 才不會出現只有其中一邊擋得住非圖片的漏洞。
export function shopImage(bytes: Buffer) {
  if (!bytes.length) throw new ShopInputError("圖片是空的，請重新選擇");
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new ShopInputError("圖片不得超過 3MB，請先壓縮再上傳");
  const mime = imageMime(bytes);
  if (!mime || !IMAGE_TYPES[mime])
    throw new ShopInputError("只接受 JPG、PNG、WebP 或 GIF 圖片");
  const id = createHash("sha256").update(bytes).digest("hex");
  return { id, mime, url: `/api/line-shop/img/${id}.${IMAGE_TYPES[mime]}` };
}
// 沒有既有商品要綁圖時（例如機器人上架）先存圖，拿到網址再一起寫進商品。
export async function saveShopImage(bytes: Buffer) {
  const { id, mime, url } = shopImage(bytes);
  const db = await database();
  await db.query(
    "INSERT IGNORE INTO line_shop_images (id,mime,bytes) VALUES (?,?,?)",
    [id, mime, bytes]
  );
  return url;
}
// 商店首頁只認這幾種 catalog，機器人上架時也必須挑其中一個。
export const SHOP_CATALOGS = [
  "shop",
  "supermarket",
  "costco",
  "exclusive",
  "ai",
] as const;
export type ShopCatalog = (typeof SHOP_CATALOGS)[number];
export type NewShopProduct = {
  // 外部系統（拍照雷達）會帶自己的商品編號進來，沒帶才由商店自動產生。
  id?: string;
  name: string;
  price: number;
  stock: number;
  catalog: ShopCatalog;
  desc: string;
  image?: string;
  spec?: string;
  jp?: string;
  tag?: string;
};
// 外部帶進來的編號要能安全放進網址與 SQL 參數，也必須看得出是哪個系統建的。
const NEW_PRODUCT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/;
function newProductId(input: string | undefined) {
  if (input === undefined) {
    return `TG-${Date.now().toString(36).toUpperCase()}${randomBytes(2)
      .toString("hex")
      .toUpperCase()}`;
  }
  const id = typeof input === "string" ? input.trim() : "";
  if (!NEW_PRODUCT_ID.test(id))
    throw new ShopInputError("商品編號只能用英數、點、底線與減號，長度 2–40");
  return id;
}
// 給 Telegram 機器人與拍照雷達用的新增商品。沒帶 id 時固定用 TG- 開頭，
// 後台一看就知道是從機器人上架的，不是目錄檔帶進來的。
export async function createShopProduct(input: NewShopProduct) {
  const name = contentText("name", input.name);
  if (!name) throw new ShopInputError("請輸入商品名稱");
  const desc = contentText("desc", input.desc ?? "");
  const image = contentText("image", input.image ?? "");
  if (!SHOP_CATALOGS.includes(input.catalog))
    throw new ShopInputError("商品分類不正確");
  if (
    !Number.isSafeInteger(input.price) ||
    input.price < 1 ||
    input.price > MAX_PRODUCT_PRICE_TWD
  )
    throw new ShopInputError(`價格需為 1–${MAX_PRODUCT_PRICE_TWD} 的整數`);
  if (
    !Number.isSafeInteger(input.stock) ||
    input.stock < 0 ||
    input.stock > MAX_PRODUCT_STOCK
  )
    throw new ShopInputError(`庫存需為 0–${MAX_PRODUCT_STOCK} 的整數`);
  const id = newProductId(input.id);
  if (excluded.has(id)) throw new ShopInputError("此商品已封存，不可上架");
  // 目錄檔沒有的欄位一律給空字串，前台才不會把 undefined 印成文字。
  // weight 給 null 是既有慣例（199 項裡有 177 項沒有重量），
  // 前台看到 null 會跳過重量累加，undefined 反而會算出 NaN。
  const product = {
    id,
    name,
    price: input.price,
    catalog: input.catalog,
    spec: contentText("spec", input.spec ?? ""),
    jp: contentText("jp", input.jp ?? ""),
    tag: contentText("tag", input.tag ?? ""),
    category: "",
    desc,
    image,
    weight: null,
  };
  const db = await database();
  // 編號是主鍵，重複時 INSERT 會拋錯；先查一次才能回「編號已存在」而不是 503。
  const [existing] = await db.query<RowDataPacket[]>(
    "SELECT id FROM line_shop_products WHERE id=?",
    [id]
  );
  if (existing.length)
    throw new ShopInputError(`商品編號「${id}」已經存在，請改用 PATCH 更新`);
  await db.query(
    "INSERT INTO line_shop_products (id,data_json,stock,active) VALUES (?,?,?,TRUE)",
    [id, JSON.stringify(product), input.stock]
  );
  return { ...product, stock: input.stock };
}
async function ensureProductContentColumn(db: Pool) {
  const [cols] = await db.query<RowDataPacket[]>(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='line_shop_products' AND COLUMN_NAME='admin_json'"
  );
  if (!cols.length)
    await db.query(
      "ALTER TABLE line_shop_products ADD COLUMN admin_json JSON NULL"
    );
}
async function ensureStoreColumn(db: Pool) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='line_shop_orders' AND COLUMN_NAME='store_id'"
  );
  if (!Number(rows[0]?.n))
    await db.query(
      "ALTER TABLE line_shop_orders ADD COLUMN store_id VARCHAR(40) NULL"
    );
}
type MigrationConn = Pick<
  PoolConnection,
  "query" | "execute" | "beginTransaction" | "commit" | "rollback"
>;

// 一次性資料修正：先取鎖、確認 migration_key 沒套用過，再在交易裡執行。
// 多個 migration 共用同一條連線，避免開機時把連線池佔滿。
async function onceWithLock(
  conn: MigrationConn,
  lockName: string,
  migrationKey: string,
  run: () => Promise<void>
) {
  const [locks] = await conn.query<RowDataPacket[]>(
    "SELECT GET_LOCK(?,60) AS acquired",
    [lockName]
  );
  if (Number(locks[0]?.acquired) !== 1)
    throw new Error(`Could not acquire LINE shop migration lock ${lockName}`);
  try {
    await conn.beginTransaction();
    const [applied] = await conn.execute<RowDataPacket[]>(
      "SELECT migration_key FROM line_shop_migrations WHERE migration_key=? FOR UPDATE",
      [migrationKey]
    );
    if (!applied.length) {
      await run();
      await conn.execute(
        "INSERT INTO line_shop_migrations (migration_key) VALUES (?)",
        [migrationKey]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.query("SELECT RELEASE_LOCK(?)", [lockName]);
  }
}
async function runShopMigrations(db: Pool) {
  const conn = await db.getConnection();
  try {
    await onceWithLock(
      conn,
      "line_shop_stock_reset_2026_10_14",
      STOCK_RESET_MIGRATION,
      async () => {
        await conn.execute(
          "UPDATE line_shop_products SET stock=10 WHERE active=TRUE AND id<>'EXC002'"
        );
      }
    );
    // 商品圖原本外連到別人的測試站，對方關站就會全部失效。圖檔已改放在
    // 本站 /line-shop/img/，但 catalog() 讀的是資料庫的 data_json，而開機
    // 時的 INSERT IGNORE 不會更新既有資料列，所以這裡要一次性換掉舊網址。
    await onceWithLock(
      conn,
      "line_shop_self_hosted_images_2026_10_30",
      SELF_HOSTED_IMAGES_MIGRATION,
      async () => {
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT id,data_json FROM line_shop_products"
        );
        const localImages = new Map(seed.map(p => [p.id, p.image]));
        for (const row of rows) {
          const local = localImages.get(row.id);
          if (!local || !local.startsWith("/line-shop/img/")) continue;
          const stored = parsed<ShopProduct>(row.data_json);
          const image = typeof stored.image === "string" ? stored.image : "";
          // 只換掉外部圖床與內嵌 base64，後台自己填的網址不動。
          if (!/chatgpt\.site|^data:image/.test(image)) continue;
          await conn.execute(
            "UPDATE line_shop_products SET data_json=? WHERE id=?",
            [JSON.stringify({ ...stored, image: local }), row.id]
          );
        }
      }
    );
  } finally {
    conn.release();
  }
}
async function catalog(db: Pool | PoolConnection) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id,data_json,stock,admin_json FROM line_shop_products WHERE active=TRUE ORDER BY id"
  );
  return rows
    .filter(r => !excluded.has(r.id))
    .map(r => {
      const stored = parsed<ShopProduct>(r.data_json);
      const admin: ProductContent = r.admin_json
        ? parsed<ProductContent>(r.admin_json)
        : {};
      const product: ShopProduct = { ...stored, ...admin };
      const publicProduct: ShopProduct = {
        id: product.id,
        name: product.name,
        price: product.price,
        stock: r.stock,
        catalog: product.catalog,
        // Costco's Japanese label is sourced from receipts and can contain
        // internal shorthand. Keep it out of every customer-facing surface.
        jp: product.catalog === "costco" ? "" : product.jp,
        spec: product.spec,
        weight: product.weight,
        tag: product.tag,
        category: product.category,
        // 後台改過的說明優先；沒改過才用目錄檔（資料庫那份可能較舊）。
        desc:
          admin.desc ?? customerDescriptions.get(product.id) ?? product.desc,
        jan: product.jan,
        image: product.image,
        imageCrop: product.imageCrop,
        source: product.source,
        ingredients: product.ingredients,
        storage: product.storage,
        freeShipping: product.freeShipping === true,
      };
      if (product.catalog === "costco") {
        delete publicProduct.jan;
        delete publicProduct.source;
      }
      if (product.id === "EXC002") delete publicProduct.source;
      return publicProduct;
    });
}
async function orderById(db: Pool | PoolConnection, id: string, lock = false) {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM line_shop_orders WHERE id=?" + (lock ? " FOR UPDATE" : ""),
    [id]
  );
  return rows[0];
}
async function enqueue(
  db: Pool | PoolConnection,
  id: string,
  kind: string,
  recipient: string,
  subject: string,
  body: string
) {
  await db.execute(
    "INSERT IGNORE INTO line_shop_mail (order_id,kind,recipient,subject,body) VALUES (?,?,?,?,?)",
    [id, kind, recipient, subject, body]
  );
}
async function queuePaymentReminders(db: Pool) {
  const [orders] = await db.query<RowDataPacket[]>(
    `SELECT o.* FROM line_shop_orders o
     INNER JOIN line_shop_mail original ON original.order_id=o.id AND original.kind='payment_ready'
     WHERE o.status='pending' AND o.mode='live' AND o.session_id IS NOT NULL
       AND original.created_at<=CURRENT_TIMESTAMP-INTERVAL 12 HOUR
       AND original.created_at>CURRENT_TIMESTAMP-INTERVAL 24 HOUR
       AND NOT EXISTS (SELECT 1 FROM line_shop_mail reminder WHERE reminder.order_id=o.id AND reminder.kind='payment_reminder_12h')
     ORDER BY original.created_at LIMIT 20`
  );
  const stripe = new Stripe(key());
  for (const order of orders) {
    try {
      const session = await stripe.checkout.sessions.retrieve(order.session_id);
      if (!canRemind(order as any, session)) continue;
      const customer = parsed<any>(order.customer_json);
      await enqueue(
        db,
        order.id,
        "payment_reminder_12h",
        customer.email,
        `ROKA IZUMI｜付款提醒 ${order.id}`,
        reminderText(order as any, session)
      );
    } catch {
      console.error("LINE shop payment reminder check will retry");
    }
  }
}
let draining = false;
export async function drainShopMail() {
  if (draining || !configured() || !live()) return;
  draining = true;
  try {
    const db = await database();
    // Runs on the existing one-minute mail timer, including after restarts.
    try {
      await queuePaymentReminders(db);
    } catch {
      console.error("LINE shop payment reminder queue will retry");
    }
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM line_shop_mail WHERE state='pending' ORDER BY id LIMIT 10"
    );
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465 || process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    for (const mail of rows) {
      const [claimed] = await db.execute<mysql.ResultSetHeader>(
        "UPDATE line_shop_mail SET state='sending' WHERE id=? AND state='pending'",
        [mail.id]
      );
      if (!claimed.affectedRows) continue;
      try {
        if (mail.kind === "payment_reminder_12h") {
          const order = await orderById(db, mail.order_id);
          if (!order || order.status !== "pending" || order.mode !== "live") {
            await db.execute(
              "UPDATE line_shop_mail SET state='cancelled' WHERE id=?",
              [mail.id]
            );
            continue;
          }
          // Check Stripe again immediately before sending: payment webhooks may be delayed.
          let session: Stripe.Checkout.Session;
          try {
            session = await new Stripe(key()).checkout.sessions.retrieve(
              order.session_id
            );
          } catch {
            // No SMTP attempt occurred, so this check can safely retry on the next tick.
            await db.execute(
              "UPDATE line_shop_mail SET state='pending' WHERE id=?",
              [mail.id]
            );
            continue;
          }
          if (!canRemind(order as any, session)) {
            await db.execute(
              "UPDATE line_shop_mail SET state='cancelled' WHERE id=?",
              [mail.id]
            );
            continue;
          }
        }
        const sent = await transport.sendMail({
          from: process.env.EMAIL_FROM || "ROKA IZUMI <info@rokaizumi-tw.jp>",
          to: mail.recipient,
          subject: mail.subject,
          text: mail.body,
          messageId: `<line-shop-${mail.id}@rokaizumi-tw.jp>`,
        });
        if (!sent.accepted?.length) throw new Error("No accepted recipient");
        await db.execute(
          "UPDATE line_shop_mail SET state='sent',message_id=? WHERE id=?",
          [sent.messageId, mail.id]
        );
      } catch {
        // Timeout may happen after acceptance. Do not automatically send a duplicate.
        await db.execute(
          "UPDATE line_shop_mail SET state='review' WHERE id=?",
          [mail.id]
        );
      }
    }
    transport.close();
  } catch {
    console.error("LINE shop notification queue unavailable");
  } finally {
    draining = false;
  }
}
function customerInput(value: any) {
  const text = (s: unknown, max: number) =>
    typeof s === "string" && s.trim().length > 0 && s.trim().length <= max
      ? s.trim()
      : null;
  const customer = {
    name: text(value?.name, 100),
    email: text(value?.email, 320),
    phone: text(value?.phone, 40),
    address: text(value?.address, 500),
    postalCode: text(value?.postalCode, 6),
  };
  if (
    !customer.name ||
    !customer.email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
    !customer.phone ||
    !/^[+\d ()-]{8,40}$/.test(customer.phone) ||
    !customer.address ||
    !customer.postalCode ||
    !/^\d{3}(\d{2,3})?$/.test(customer.postalCode)
  )
    throw new ShopInputError(
      "請完整填寫台灣收件姓名、Email、電話、地址與郵遞區號"
    );
  return customer;
}
function merchantCustomerDetails(customer: any) {
  return `收件姓名：${customer.name}\n聯絡Email：${customer.email}\n電話：${customer.phone}\n郵遞區號：${customer.postalCode}\n收件地址：${customer.address}`;
}
function summary(order: RowDataPacket) {
  return {
    id: order.id,
    status: order.status,
    mode: order.mode,
    items: parsed(order.items_json),
    subtotalTwd: order.subtotal,
    shippingTwd: order.shipping,
    totalTwd: order.shipping === null ? null : order.subtotal + order.shipping,
    checkoutUrl: order.status === "pending" ? order.checkout_url : null,
  };
}
function handled(fn: (req: Request, res: Response) => Promise<any>) {
  return async (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      await fn(req, res);
    } catch (e) {
      res.status(e instanceof ShopInputError ? 400 : 503).json({
        error:
          e instanceof ShopInputError
            ? e.message
            : "服務暫時無法使用，請稍後再試",
      });
    }
  };
}
router.use((_req, res, next) => {
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
router.get("/config", (_req, res) =>
  res.json({
    enabled: configured(),
    mode: live() ? "live" : "test",
    termsVersion: TERMS_VERSION,
  })
);
router.get("/products", handled(async (_req, res) => {
    res.json({ products: await catalog(await database()) });
  })
);
// 後台上傳的商品圖。公開可讀（前台 <img> 要用），檔名是內容雜湊，
// 同一張圖永遠是同一個網址，所以可以永久快取。
router.get("/img/:file", async (req, res) => {
  const file = String(req.params.file);
  const id = file.replace(/\.[a-z]+$/, "");
  if (!/^[0-9a-f]{64}$/.test(id)) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }
  try {
    const db = await database();
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT mime, bytes FROM line_shop_images WHERE id=?",
      [id]
    );
    const row = rows[0];
    if (!row) {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    res.setHeader("Content-Type", String(row.mime));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(row.bytes);
  } catch {
    res.status(503).type("text/plain").send("Service unavailable");
  }
});
router.use((req, res, next) => {
  if (req.method === "GET") return next();
  let submitted = "";
  try {
    submitted = requestOrigin(req);
  } catch {
    submitted = "";
  }
  if (!shopOrigins().has(submitted))
    return res.status(403).json({ error: "請從商店頁面提交" });
  next();
});
router.post(
  "/orders",
  handled(async (req, res) => {
    if (!configured())
      return res.status(503).json({ error: "刷卡設定尚未完成，暫未開放下單" });
    if (
      req.body?.termsVersion !== TERMS_VERSION ||
      req.body?.consent !== true ||
      !/^[A-Za-z0-9_-]{16,64}$/.test(req.body?.idempotencyKey || "") ||
      !/^[a-f0-9]{64}$/.test(req.body?.token || "")
    )
      throw new ShopInputError("請重新整理並確認購物說明");
    const customer = customerInput(req.body.customer);
    const db = await database();
    const [existing] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM line_shop_orders WHERE request_key=?",
      [req.body.idempotencyKey]
    );
    const products = existing[0]
      ? parsed<ShopItem[]>(existing[0].items_json).map(i => ({
          id: i.productId,
          name: i.name,
          price: i.unitPriceTwd,
          stock: i.quantity,
          catalog: "existing",
        }))
      : await catalog(db);
    const resolved = resolveShopItems(req.body.items, products);
    const fingerprint = hash(
      JSON.stringify({ resolved, customer, mode: live() ? "live" : "test" })
    );
    if (existing[0]) {
      if (
        existing[0].request_hash !== fingerprint ||
        existing[0].token_hash !== hash(req.body.token)
      )
        return res.status(409).json({ error: "提交識別碼已使用，請重新整理" });
      return res.json(await preparePayment(existing[0].id));
    }
    // Render appends the source address; use its last proxy entry only.
    const sourceIp = process.env.RENDER
      ? req.get("x-forwarded-for")?.split(",").at(-1)?.trim() || req.ip
      : req.ip;
    const bucket = hash(
      (process.env.JWT_SECRET || key()) +
        sourceIp +
        Math.floor(Date.now() / 900000)
    );
    await db.execute(
      "INSERT INTO line_shop_limits (bucket,hits,expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1",
      [bucket, Date.now() + 900000]
    );
    const [limits] = await db.execute<RowDataPacket[]>(
      "SELECT hits FROM line_shop_limits WHERE bucket=?",
      [bucket]
    );
    if (limits[0].hits > 10)
      return res.status(429).json({ error: "提交次數過多，請稍後再試" });
    await db.execute("DELETE FROM line_shop_limits WHERE expires_at<?", [
      Date.now(),
    ]);
    const conn = await db.getConnection();
    const id = "RZ-" + randomUUID();
    const storeId = await primaryStoreId(db);
    try {
      await conn.beginTransaction();
      await conn.execute(
        "INSERT INTO line_shop_orders (id,request_key,request_hash,token_hash,items_json,customer_json,subtotal,mode,store_id) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          id,
          req.body.idempotencyKey,
          fingerprint,
          hash(req.body.token),
          JSON.stringify(resolved.items),
          JSON.stringify(customer),
          resolved.subtotalTwd,
          live() ? "live" : "test",
          storeId,
        ]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
    res.status(201).json(await preparePayment(id));
  })
);
router.get(
  "/orders/:id",
  handled(async (req, res) => {
    const order = await orderById(await database(), String(req.params.id));
    if (
      !order ||
      typeof req.query.token !== "string" ||
      order.token_hash !== hash(req.query.token)
    )
      return res.status(404).json({ error: "找不到訂單" });
    res.json(summary(order));
  })
);
// ========== 商店登錄與後台登入 ==========

function storeText(
  value: unknown,
  max: number,
  label: string,
  required = true
) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    if (required) throw new ShopInputError(`請填寫${label}`);
    return "";
  }
  if (text.length > max) throw new ShopInputError(`${label}不得超過 ${max} 字`);
  return text;
}

function storeInput(body: any) {
  const name = storeText(body?.name, 120, "商店名稱");
  const contactName = storeText(body?.contactName, 100, "聯絡人");
  const phone = storeText(body?.phone, 40, "聯絡電話");
  if (!/^[+\d ()-]{8,40}$/.test(phone))
    throw new ShopInputError("請填寫有效的聯絡電話");
  const email = storeText(body?.email, 320, "聯絡 Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new ShopInputError("請填寫有效的聯絡 Email");
  const lineId = storeText(body?.lineId, 100, "LINE ID", false);
  const address = storeText(body?.address, 500, "商店地址", false);
  const taxId = storeText(body?.taxId, 20, "統一編號", false);
  if (taxId && !/^\d{8}$/.test(taxId))
    throw new ShopInputError("統一編號為 8 位數字");
  return { name, contactName, phone, email, lineId, address, taxId };
}

function storeView(row: RowDataPacket) {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    lineId: row.line_id,
    address: row.address,
    taxId: row.tax_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function storeByOwner(db: Pool | PoolConnection, ownerId: number) {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT * FROM line_shop_stores WHERE owner_user_id=?",
    [ownerId]
  );
  return rows[0] || null;
}

/** 目前商店後台預設服務的商店：最早成立且啟用中的一間。 */
async function primaryStoreId(db: Pool | PoolConnection) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id FROM line_shop_stores WHERE status='active' ORDER BY created_at,id LIMIT 1"
  );
  return rows[0]?.id ? String(rows[0].id) : null;
}

async function shopUser(req: Request) {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

async function setShopSession(
  req: Request,
  res: Response,
  openId: string,
  name: string
) {
  const token = await sdk.createSessionToken(openId, {
    name: name || "",
    expiresInMs: ONE_YEAR_MS,
  });
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: ONE_YEAR_MS,
  });
}

/** 後台登入/註冊的嘗試次數限制，避免被用來暴力猜密碼。 */
async function allowAuthAttempt(
  db: Pool,
  req: Request,
  action: string,
  max: number
) {
  const sourceIp = process.env.RENDER
    ? req.get("x-forwarded-for")?.split(",").at(-1)?.trim() || req.ip
    : req.ip;
  const bucket = hash(
    (process.env.JWT_SECRET || key() || "line-shop") +
      action +
      sourceIp +
      Math.floor(Date.now() / 900000)
  );
  await db.execute(
    "INSERT INTO line_shop_limits (bucket,hits,expires_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1",
    [bucket, Date.now() + 900000]
  );
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT hits FROM line_shop_limits WHERE bucket=?",
    [bucket]
  );
  await db.execute("DELETE FROM line_shop_limits WHERE expires_at<?", [
    Date.now(),
  ]);
  return Number(rows[0]?.hits || 0) <= max;
}

async function ordersPayload(db: Pool, storeId?: string) {
  const params = storeId ? [storeId] : [];
  const [orders] = await db.query<RowDataPacket[]>(
    `SELECT o.*, f.status AS fulfillment_status, f.tracking_number, f.shipped_at FROM line_shop_orders o LEFT JOIN line_shop_fulfillment f ON f.order_id=o.id${
      storeId ? " WHERE o.store_id=?" : ""
    } ORDER BY o.created_at DESC LIMIT 100`,
    params
  );
  const [mail] = await db.query<RowDataPacket[]>(
    storeId
      ? "SELECT m.id,m.order_id,m.kind,m.state,m.created_at FROM line_shop_mail m INNER JOIN line_shop_orders o ON o.id=m.order_id WHERE o.store_id=? ORDER BY m.id DESC LIMIT 200"
      : "SELECT id,order_id,kind,state,created_at FROM line_shop_mail ORDER BY id DESC LIMIT 200",
    params
  );
  return {
    orders: orders.map(o => ({
      ...summary(o),
      customer: parsed(o.customer_json),
      createdAt: o.created_at,
      weightGrams: o.weight_grams,
      fulfillmentStatus:
        o.status === "paid"
          ? o.fulfillment_status || "awaiting_preparation"
          : "unpaid",
      trackingNumber: o.tracking_number || "",
      shippedAt: o.shipped_at,
    })),
    mail,
  };
}

/** 出貨狀態更新。storeId 有值時，只能操作該商店自己的訂單。 */
async function applyFulfillment(
  req: Request,
  res: Response,
  storeId?: string
) {
  const status = req.body?.status;
  const tracking = req.body?.trackingNumber ?? "";
  if (
    !["preparing", "shipped"].includes(status) ||
    typeof tracking !== "string" ||
    tracking.length > 100 ||
    /[\r\n]/.test(tracking)
  )
    throw new ShopInputError("請選擇備貨中或已出貨，物流單號不得超過100字");
  const db = await database();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const order = await orderById(conn, String(req.params.id), true);
    if (!order || (storeId && order.store_id !== storeId)) {
      await conn.rollback();
      return res.status(404).json({ error: "找不到訂單" });
    }
    if (order.status !== "paid") {
      await conn.rollback();
      return res.status(409).json({ error: "尚未確認付款，無法安排出貨" });
    }
    const [rows] = await conn.execute<RowDataPacket[]>(
      "SELECT * FROM line_shop_fulfillment WHERE order_id=?",
      [order.id]
    );
    const current = rows[0];
    if (current?.status === "shipped" && status !== "shipped") {
      await conn.rollback();
      return res.status(409).json({ error: "已出貨訂單不能改回備貨中" });
    }
    if (status === "shipped" && !current) {
      await conn.rollback();
      return res.status(409).json({ error: "請先將訂單設為備貨中" });
    }
    await conn.execute(
      "INSERT INTO line_shop_fulfillment (order_id,status,tracking_number,shipped_at) VALUES (?,?,?,IF(?='shipped',CURRENT_TIMESTAMP,NULL)) ON DUPLICATE KEY UPDATE status=VALUES(status),tracking_number=VALUES(tracking_number),shipped_at=IF(VALUES(status)='shipped',COALESCE(shipped_at,CURRENT_TIMESTAMP),NULL)",
      [order.id, status, tracking.trim(), status]
    );
    await conn.commit();
    res.json({
      id: order.id,
      fulfillmentStatus: status,
      trackingNumber: tracking.trim(),
    });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

router.get(
  "/auth/me",
  handled(async (req, res) => {
    const user = await shopUser(req);
    if (!user) return res.json({ user: null, store: null });
    const db = await database();
    const store = await storeByOwner(db, user.id);
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      store: store ? storeView(store) : null,
    });
  })
);

router.post(
  "/auth/register",
  handled(async (req, res) => {
    const db = await database();
    if (!(await allowAuthAttempt(db, req, "register", 10)))
      return res.status(429).json({ error: "註冊次數過多，請稍後再試" });
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? "");
    const name = String(req.body?.name ?? "")
      .trim()
      .slice(0, 100);
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ShopInputError("請填寫有效的 Email");
    if (password.length < 8 || password.length > 100)
      throw new ShopInputError("密碼至少 8 個字");
    const [existing] = await db.execute<RowDataPacket[]>(
      "SELECT id FROM users WHERE email=? LIMIT 1",
      [email]
    );
    if (existing.length)
      return res.status(409).json({ error: "此 Email 已註冊，請直接登入" });
    const openId = "local:" + randomBytes(12).toString("hex");
    const [created] = await db.execute<mysql.ResultSetHeader>(
      "INSERT INTO users (openId,name,email,loginMethod,role,passwordHash) VALUES (?,?,?,?,?,?)",
      [openId, name || null, email, "local", "user", hashPassword(password)]
    );
    await setShopSession(req, res, openId, name);
    res.status(201).json({
      ok: true,
      user: { id: created.insertId, name: name || null, email, role: "user" },
      store: null,
    });
  })
);

router.post(
  "/auth/login",
  handled(async (req, res) => {
    const db = await database();
    if (!(await allowAuthAttempt(db, req, "login", 10)))
      return res.status(429).json({ error: "登入次數過多，請 15 分鐘後再試" });
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!email || !password) throw new ShopInputError("請輸入 Email 與密碼");
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT id,openId,name,email,role,passwordHash FROM users WHERE email=? LIMIT 1",
      [email]
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.passwordHash))
      return res.status(401).json({ error: "Email 或密碼錯誤" });
    await db.execute(
      "UPDATE users SET lastSignedIn=CURRENT_TIMESTAMP WHERE id=?",
      [user.id]
    );
    await setShopSession(req, res, user.openId, user.name || "");
    const store = await storeByOwner(db, user.id);
    res.json({
      ok: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      store: store ? storeView(store) : null,
    });
  })
);

router.post(
  "/auth/logout",
  handled(async (req, res) => {
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ ok: true });
  })
);

router.get(
  "/store",
  handled(async (req, res) => {
    const user = await shopUser(req);
    if (!user) return res.status(401).json({ error: "請先登入" });
    const db = await database();
    const store = await storeByOwner(db, user.id);
    res.json({ store: store ? storeView(store) : null });
  })
);

router.post(
  "/store",
  handled(async (req, res) => {
    const user = await shopUser(req);
    if (!user) return res.status(401).json({ error: "請先登入" });
    const input = storeInput(req.body);
    const db = await database();
    if (await storeByOwner(db, user.id))
      return res
        .status(409)
        .json({ error: "此帳號已登錄商店，請直接編輯商店資料" });
    // 一般帳號登錄的商店需由管理員審核；管理員自己登錄則直接啟用。
    const status = user.role === "admin" ? "active" : "pending";
    const [counts] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM line_shop_stores WHERE status='active'"
    );
    const firstActive = status === "active" && Number(counts[0]?.n || 0) === 0;
    const id = "ST-" + randomUUID();
    await db.execute(
      "INSERT INTO line_shop_stores (id,owner_user_id,name,contact_name,phone,email,line_id,address,tax_id,status) VALUES (?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        user.id,
        input.name,
        input.contactName,
        input.phone,
        input.email,
        input.lineId,
        input.address,
        input.taxId,
        status,
      ]
    );
    // 第一間啟用中的商店成立時，把先前沒有歸屬的訂單接過來，避免舊訂單消失。
    if (firstActive)
      await db.execute(
        "UPDATE line_shop_orders SET store_id=? WHERE store_id IS NULL",
        [id]
      );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM line_shop_stores WHERE id=?",
      [id]
    );
    res.status(201).json({ store: storeView(rows[0]) });
  })
);

router.put(
  "/store",
  handled(async (req, res) => {
    const user = await shopUser(req);
    if (!user) return res.status(401).json({ error: "請先登入" });
    const input = storeInput(req.body);
    const db = await database();
    const store = await storeByOwner(db, user.id);
    if (!store) return res.status(404).json({ error: "尚未登錄商店" });
    await db.execute(
      "UPDATE line_shop_stores SET name=?,contact_name=?,phone=?,email=?,line_id=?,address=?,tax_id=? WHERE id=?",
      [
        input.name,
        input.contactName,
        input.phone,
        input.email,
        input.lineId,
        input.address,
        input.taxId,
        store.id,
      ]
    );
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM line_shop_stores WHERE id=?",
      [store.id]
    );
    res.json({ store: storeView(rows[0]) });
  })
);

router.get(
  "/store/orders",
  handled(async (req, res) => {
    const user = await shopUser(req);
    if (!user) return res.status(401).json({ error: "請先登入" });
    const db = await database();
    const store = await storeByOwner(db, user.id);
    if (!store) return res.status(403).json({ error: "請先登錄商店" });
    if (store.status !== "active")
      return res.status(403).json({ error: "商店仍在審核中，請稍後再試" });
    res.json(await ordersPayload(db, store.id));
  })
);

router.post(
  "/store/orders/:id/fulfillment",
  handled(async (req, res) => {
    const user = await shopUser(req);
    if (!user) return res.status(401).json({ error: "請先登入" });
    const db = await database();
    const store = await storeByOwner(db, user.id);
    if (!store) return res.status(403).json({ error: "請先登錄商店" });
    if (store.status !== "active")
      return res.status(403).json({ error: "商店仍在審核中，請稍後再試" });
    return applyFulfillment(req, res, store.id);
  })
);

router.post(
  "/store/orders/:id/quote",
  handled(async (req, res) => {
    const user = await shopUser(req);
    if (!user) return res.status(401).json({ error: "請先登入" });
    const db = await database();
    const store = await storeByOwner(db, user.id);
    if (!store) return res.status(403).json({ error: "請先登錄商店" });
    if (store.status !== "active")
      return res.status(403).json({ error: "商店仍在審核中，請稍後再試" });
    if (!configured())
      return res.status(503).json({ error: "Stripe 設定尚未完成" });
    if (
      req.body?.supplyConfirmed !== true ||
      req.body?.shippingAllowedConfirmed !== true
    )
      throw new ShopInputError("請先確認供貨與寄送條件");
    res.json(
      await preparePayment(
        String(req.params.id),
        req.body.packedWeightGrams,
        store.id
      )
    );
  })
);

router.use("/admin", async (req, res, next) => {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role === "admin") return next();
  } catch {}
  res.status(401).json({ error: "請先以管理員帳號登入" });
});

// 商品上架管理。價格與庫存改資料庫，商店頁直接讀同一份資料，改完立即生效。
router.post(
  "/admin/products",
  handled(async (req, res) => {
    const body = req.body ?? {};
    const editable = ["id", "catalog", "price", "stock", ...CONTENT_FIELDS];
    const keys = Object.keys(body);
    if (!keys.length || keys.some(k => !editable.includes(k)))
      throw new ShopInputError(
        "只能指定商品編號、分類、價格、庫存與商品內容"
      );
    const product = await createShopProduct({
      id: body.id,
      name: body.name,
      desc: body.desc,
      spec: body.spec,
      jp: body.jp,
      tag: body.tag,
      image: body.image,
      catalog: body.catalog,
      price: body.price,
      stock: body.stock,
    });
    res.status(201).json({
      ...product,
      active: true,
      overridden: [],
      blocked: false,
    });
  })
);

router.get(
  "/admin/products",
  handled(async (_req, res) => {
    const db = await database();
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT id,data_json,stock,active,admin_json FROM line_shop_products ORDER BY id"
    );
    res.json({
      products: rows.map(r => {
        const stored = parsed<ShopProduct>(r.data_json);
        const admin: ProductContent = r.admin_json
          ? parsed<ProductContent>(r.admin_json)
          : {};
        const product: ShopProduct = { ...stored, ...admin };
        return {
          id: r.id,
          name: product.name,
          jp: typeof product.jp === "string" ? product.jp : "",
          spec: typeof product.spec === "string" ? product.spec : "",
          tag: typeof product.tag === "string" ? product.tag : "",
          desc:
            admin.desc ??
            customerDescriptions.get(product.id) ??
            (typeof product.desc === "string" ? product.desc : ""),
          catalog: product.catalog,
          price: product.price,
          stock: Number(r.stock),
          active: Boolean(r.active),
          image: typeof product.image === "string" ? product.image : "",
          overridden: Object.keys(admin),
          // 封存名單寫在程式碼裡（法規或供貨問題），不可用介面重新上架。
          blocked: excluded.has(r.id),
        };
      }),
    });
  })
);

router.patch(
  "/admin/products/:id",
  handled(async (req, res) => {
    const body = req.body ?? {};
    const keys = Object.keys(body);
    const editable = ["active", "price", "stock", ...CONTENT_FIELDS];
    if (!keys.length || keys.some(k => !editable.includes(k)))
      throw new ShopInputError("只能修改上架狀態、價格、庫存與商品內容");

    const id = String(req.params.id);
    const db = await database();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<RowDataPacket[]>(
        "SELECT id,data_json,stock,active,admin_json FROM line_shop_products WHERE id=? FOR UPDATE",
        [id]
      );
      const row = rows[0];
      if (!row) {
        await conn.rollback();
        return res.status(404).json({ error: "找不到商品" });
      }
      const stored = parsed<ShopProduct>(row.data_json);
      const admin: ProductContent = row.admin_json
        ? parsed<ProductContent>(row.admin_json)
        : {};

      const active = body.active === undefined ? Boolean(row.active) : body.active;
      if (typeof active !== "boolean")
        throw new ShopInputError("上架狀態格式不正確");
      if (active && excluded.has(id))
        throw new ShopInputError("此商品已封存，不可上架");
      const price = body.price === undefined ? stored.price : body.price;
      if (
        !Number.isSafeInteger(price) ||
        price < 1 ||
        price > MAX_PRODUCT_PRICE_TWD
      )
        throw new ShopInputError(
          `價格需為 1–${MAX_PRODUCT_PRICE_TWD} 的整數`
        );
      const stock = body.stock === undefined ? Number(row.stock) : body.stock;
      if (
        !Number.isSafeInteger(stock) ||
        stock < 0 ||
        stock > MAX_PRODUCT_STOCK
      )
        throw new ShopInputError(`庫存需為 0–${MAX_PRODUCT_STOCK} 的整數`);

      // 留空代表還原成目錄檔的原始值，所以是把覆寫刪掉而不是存空字串。
      for (const field of CONTENT_FIELDS) {
        if (!(field in body)) continue;
        const text = contentText(field, body[field]);
        if (text) admin[field] = text;
        else delete admin[field];
      }

      await conn.execute(
        "UPDATE line_shop_products SET data_json=?, stock=?, active=?, admin_json=? WHERE id=?",
        [
          JSON.stringify({ ...stored, price }),
          stock,
          active,
          Object.keys(admin).length ? JSON.stringify(admin) : null,
          id,
        ]
      );
      await conn.commit();
      const product: ShopProduct = { ...stored, ...admin, price };
      res.json({
        id,
        name: product.name,
        spec: typeof product.spec === "string" ? product.spec : "",
        jp: typeof product.jp === "string" ? product.jp : "",
        tag: typeof product.tag === "string" ? product.tag : "",
        desc:
          admin.desc ??
          customerDescriptions.get(id) ??
          (typeof product.desc === "string" ? product.desc : ""),
        image: typeof product.image === "string" ? product.image : "",
        price,
        stock,
        active,
        overridden: Object.keys(admin),
      });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

router.post(
  "/admin/products/:id/image",
  handled(async (req, res) => {
    const data = req.body?.data;
    const match =
      typeof data === "string"
        ? /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(data)
        : null;
    if (!match) throw new ShopInputError("請選擇 JPG、PNG、WebP 或 GIF 圖片");
    const bytes = Buffer.from(match[2], "base64");
    const { id, mime, url } = shopImage(bytes);
    const productId = String(req.params.id);
    const db = await database();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.execute<RowDataPacket[]>(
        "SELECT id,admin_json FROM line_shop_products WHERE id=? FOR UPDATE",
        [productId]
      );
      const row = rows[0];
      if (!row) {
        await conn.rollback();
        return res.status(404).json({ error: "找不到商品" });
      }
      // 內容雜湊當主鍵，重複上傳同一張圖不會長出第二份。
      await conn.execute(
        "INSERT IGNORE INTO line_shop_images (id,mime,bytes) VALUES (?,?,?)",
        [id, mime, bytes]
      );
      const admin: ProductContent = row.admin_json
        ? parsed<ProductContent>(row.admin_json)
        : {};
      admin.image = url;
      await conn.execute(
        "UPDATE line_shop_products SET admin_json=? WHERE id=?",
        [JSON.stringify(admin), productId]
      );
      await conn.commit();
      res.json({ id: productId, image: url });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  })
);

router.get(
  "/admin/orders",
  handled(async (_req, res) => {
    res.json(await ordersPayload(await database()));
  })
);
router.get(
  "/admin/stores",
  handled(async (_req, res) => {
    const db = await database();
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT s.*, u.email AS owner_email FROM line_shop_stores s LEFT JOIN users u ON u.id=s.owner_user_id ORDER BY s.created_at"
    );
    res.json({
      stores: rows.map(row => ({
        ...storeView(row),
        ownerEmail: row.owner_email,
      })),
    });
  })
);
router.post(
  "/admin/stores/:id/status",
  handled(async (req, res) => {
    const status = req.body?.status;
    if (!["active", "suspended"].includes(status))
      throw new ShopInputError("請選擇啟用或停用");
    const db = await database();
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM line_shop_stores WHERE id=?",
      [String(req.params.id)]
    );
    const store = rows[0];
    if (!store) return res.status(404).json({ error: "找不到商店" });
    await db.execute("UPDATE line_shop_stores SET status=? WHERE id=?", [
      status,
      store.id,
    ]);
    if (status === "active" && store.status !== "active") {
      const [active] = await db.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM line_shop_stores WHERE status='active' AND id<>?",
        [store.id]
      );
      if (Number(active[0]?.n || 0) === 0)
        await db.execute(
          "UPDATE line_shop_orders SET store_id=? WHERE store_id IS NULL",
          [store.id]
        );
    }
    res.json({ store: { ...storeView(store), status } });
  })
);
router.post(
  "/admin/orders/:id/fulfillment",
  handled(async (req, res) => applyFulfillment(req, res))
);
async function preparePayment(
  id: string,
  packedWeightGrams?: unknown,
  storeId?: string
) {
  let quote: {
    shippingTwd: number;
    emsJpy: number | null;
    packedWeightGrams: number | null;
  };
  const db = await database();
  const conn = await db.getConnection();
  let order: RowDataPacket;
  try {
    await conn.beginTransaction();
    order = (await orderById(conn, id, true))!;
    if (
      !order ||
      order.mode !== (live() ? "live" : "test") ||
      (storeId && order.store_id !== storeId)
    )
      throw new ShopInputError("找不到相同模式的訂單");
    if (
      ["pending", "paid", "expired"].includes(order.status) &&
      order.session_id
    ) {
      await conn.commit();
      return summary(order);
    }
    const orderItems = parsed<ShopItem[]>(order.items_json);
    const shippingSubtotalTwd = orderItems.reduce(
      (n, item) => n + (item.freeShipping ? 0 : item.unitPriceTwd * item.quantity),
      0
    );
    quote =
      packedWeightGrams === undefined
        ? {
            shippingTwd: shippingSubtotalTwd > 0 ? orderShippingTwd(shippingSubtotalTwd) : 0,
            emsJpy: order.ems_jpy ?? null,
            packedWeightGrams: order.weight_grams ?? null,
          }
        : shippingQuote(packedWeightGrams, shippingSubtotalTwd || 1);
    if (order.status !== "awaiting_quote" && order.status !== "quoting")
      throw new ShopInputError("此訂單不能再次建立付款");
    if (
      order.status === "quoting" &&
      order.weight_grams !== quote.packedWeightGrams
    )
      throw new ShopInputError("此訂單已保留原報價，請沿用原重量重試");
    if (!order.reserved) {
      for (const item of parsed<ShopItem[]>(order.items_json).sort((a, b) =>
        a.productId.localeCompare(b.productId)
      )) {
        const [r] = await conn.execute<mysql.ResultSetHeader>(
          "UPDATE line_shop_products SET stock=stock-? WHERE id=? AND active=TRUE AND stock>=?",
          [item.quantity, item.productId, item.quantity]
        );
        if (!r.affectedRows) throw new ShopInputError(`${item.name} 庫存不足`);
      }
    }
    await conn.execute(
      "UPDATE line_shop_orders SET shipping=?,ems_jpy=?,weight_grams=?,reserved=TRUE,status='quoting' WHERE id=?",
      [quote.shippingTwd, quote.emsJpy, quote.packedWeightGrams, order.id]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  // A timeout retains the same order and idempotency key. Retry the identical quote.
  const stripe = new Stripe(key());
  const customer = parsed<any>(order!.customer_json);
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      locale: "zh-TW",
      customer_email: customer.email,
      client_reference_id: order!.id,
      metadata: { line_shop_order: order!.id },
      line_items: [
        ...parsed<ShopItem[]>(order!.items_json).map(i => ({
          price_data: {
            currency: "twd",
            unit_amount: i.unitPriceTwd * 100,
            product_data: { name: i.name },
          },
          quantity: i.quantity,
        })),
        ...(quote.shippingTwd > 0 ? [{
          price_data: {
            currency: "twd" as const,
            unit_amount: quote.shippingTwd * 100,
            product_data: { name: "EMS 運費（一般商品運費規則）" },
          },
          quantity: 1,
        }] : []),
      ],
      success_url: `${origin()}/line-shop/payment-result.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin()}/line-shop/payment-result.html?cancelled=1`,
      custom_text: {
        submit: {
          message:
            "下單後七個工作天內從日本寄出。商品滿NT$2,000運費NT$220，滿NT$5,000免運。",
        },
      },
    },
    { idempotencyKey: "line-shop-" + order!.id }
  );
  if (!session.url || session.livemode !== live())
    throw new Error("Unexpected Stripe session");
  await db.execute(
    "UPDATE line_shop_orders SET session_id=?,checkout_url=?,status='pending' WHERE id=? AND status='quoting'",
    [session.id, session.url, order!.id]
  );
  if (live()) {
    await enqueue(
      db,
      order!.id,
      "payment_ready",
      customer.email,
      `ROKA IZUMI｜請付款 ${order!.id}`,
      `訂單：${order!.id}\n商品小計：NT$${order!.subtotal}\n運費：NT${quote.shippingTwd}（商品免運則不另收；一般商品滿NT$2,000運費NT$220，滿NT$5,000免運）\n總額：NT$${order!.subtotal + quote.shippingTwd}\nStripe 安全付款（24小時內有效）：${session.url}\n下單後七個工作天內從日本寄出。`
    );
    await enqueue(
      db,
      order!.id,
      "request_merchant",
      process.env.LINE_SHOP_NOTIFY_EMAIL || "rokaizumi@gmail.com",
      `ROKA IZUMI｜新訂單待付款 ${order!.id}`,
      `訂單：${order!.id}\n尚未付款\n商品小計：NT$${order!.subtotal}\n運費：NT$${quote.shippingTwd}\n總額：NT$${order!.subtotal + quote.shippingTwd}\n${parsed<
        ShopItem[]
      >(order!.items_json)
        .map(i => `${i.productId} ${i.name} × ${i.quantity}`)
        .join(
          "\n"
        )}\n\n${merchantCustomerDetails(customer)}\n付款完成後會另寄通知。`
    );
  }
  void drainShopMail();
  return summary((await orderById(db, order!.id))!);
}

router.post(
  "/admin/orders/:id/quote",
  handled(async (req, res) => {
    if (!configured())
      return res.status(503).json({ error: "Stripe 設定尚未完成" });
    if (
      req.body?.supplyConfirmed !== true ||
      req.body?.shippingAllowedConfirmed !== true
    )
      throw new ShopInputError("請先確認供貨與寄送條件");
    res.json(
      await preparePayment(String(req.params.id), req.body.packedWeightGrams)
    );
  })
);
router.get(
  "/session/:id",
  handled(async (req, res) => {
    const [orders] = await (
      await database()
    ).execute<RowDataPacket[]>(
      "SELECT id,status,subtotal,shipping,mode FROM line_shop_orders WHERE session_id=?",
      [req.params.id]
    );
    if (!orders[0])
      return res.status(404).json({ error: "付款結果仍在確認中" });
    const o = orders[0];
    res.json({
      id: o.id,
      status: o.status,
      totalTwd: o.subtotal + Number(o.shipping),
      mode: o.mode,
    });
  })
);
export async function lineShopWebhook(req: Request, res: Response) {
  if (!key() || !process.env.LINE_SHOP_STRIPE_WEBHOOK_SECRET)
    return res.status(503).json({ error: "Webhook not configured" });
  let event: Stripe.Event;
  try {
    event = new Stripe(key()).webhooks.constructEvent(
      req.body,
      req.get("stripe-signature") || "",
      process.env.LINE_SHOP_STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return res.status(400).json({ error: "Invalid signature" });
  }
  if (event.livemode !== live())
    return res.status(400).json({ error: "Wrong payment mode" });
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
    ].includes(event.type)
  )
    return res.json({ received: true });
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.metadata?.candleOrderId) {
    try {
      if (
        event.type !== "checkout.session.expired" &&
        session.payment_status === "paid"
      )
        await markCandleOrderPaidByStripeSessionId(session);
      return res.json({ received: true });
    } catch {
      console.error("Candle payment confirmation needs retry");
      return res
        .status(500)
        .json({ error: "Candle payment confirmation pending" });
    }
  }
  if (!session.metadata?.line_shop_order) return res.json({ received: true });
  let conn: PoolConnection | undefined;
  try {
    const db = await database();
    conn = await db.getConnection();
    await conn.beginTransaction();
    const order = await orderById(conn, session.metadata.line_shop_order, true);
    if (
      !order ||
      !["quoting", "pending", "paid", "expired"].includes(order.status)
    )
      throw new Error("Unknown order");
    if (order.session_id && order.session_id !== session.id)
      throw new Error("Session mismatch");
    if (event.type === "checkout.session.expired") {
      if (order.status !== "paid" && order.status !== "expired") {
        if (order.reserved)
          for (const i of parsed<ShopItem[]>(order.items_json))
            await conn.execute(
              "UPDATE line_shop_products SET stock=stock+? WHERE id=?",
              [i.quantity, i.productId]
            );
        await conn.execute(
          "UPDATE line_shop_orders SET status='expired',reserved=FALSE,session_id=? WHERE id=?",
          [session.id, order.id]
        );
      }
    } else if (session.payment_status === "paid") {
      if (
        !validPaidSession(session, order as any) ||
        order.status === "expired"
      )
        throw new Error("Payment amount or state mismatch");
      await conn.execute(
        "UPDATE line_shop_orders SET status='paid',session_id=?,payment_intent=? WHERE id=?",
        [
          session.id,
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null,
          order.id,
        ]
      );
      if (live()) {
        const customer = parsed<any>(order.customer_json);
        const text = `訂單：${order.id}\n已付款 NT$${order.subtotal + order.shipping}（商品 NT$${order.subtotal}＋運費 NT${order.shipping}）\n${parsed<
          ShopItem[]
        >(order.items_json)
          .map(i => `${i.name} × ${i.quantity}`)
          .join(
            "\n"
          )}\n下單後七個工作天內從日本寄出，送達時間另計。\n客服：info@rokaizumi-tw.jp`;
        await enqueue(
          conn,
          order.id,
          "paid_customer",
          customer.email,
          `ROKA IZUMI｜付款成功 ${order.id}`,
          text
        );
        await enqueue(
          conn,
          order.id,
          "paid_merchant",
          process.env.LINE_SHOP_NOTIFY_EMAIL || "rokaizumi@gmail.com",
          `ROKA IZUMI｜已付款・待備貨 ${order.id}`,
          text +
            `\n\n${merchantCustomerDetails(customer)}\n請到管理頁安排出貨：${origin()}/line-shop/admin.html`
        );
      }
    }
    await conn.commit();
    res.json({ received: true });
    void drainShopMail();
  } catch {
    if (conn) await conn.rollback();
    console.error("LINE shop payment confirmation needs retry");
    res.status(500).json({ error: "Payment confirmation pending" });
  } finally {
    conn?.release();
  }
}
export function registerLineShop(app: express.Express) {
  app.post(
    "/api/line-shop/stripe/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    lineShopWebhook
  );
}
export default router;
