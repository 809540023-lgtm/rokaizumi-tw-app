import express, { Router, type Request, type Response } from "express";
import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
} from "mysql2/promise";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { randomUUID, createHash } from "node:crypto";
import { markCandleOrderPaidByStripeSessionId } from "./candle-orders";
import { canRemind, reminderText } from "./line-shop-reminders";
import seed from "./public/line-shop-catalog.json";
import { sdk } from "./_core/sdk";
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
    `CREATE TABLE IF NOT EXISTS line_shop_migrations (migration_key VARCHAR(100) PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  );
  const products = seed.filter(p => !excluded.has(p.id));
  if (products.length)
    await db.query(
      "INSERT IGNORE INTO line_shop_products (id,data_json,stock) VALUES ?",
      [products.map(p => [p.id, JSON.stringify(p), p.stock])]
    );
  await setStoreStockToTen(db);
}
async function setStoreStockToTen(db: Pool) {
  const conn = await db.getConnection();
  const lockName = "line_shop_stock_reset_2026_10_14";
  try {
    const [locks] = await conn.query<RowDataPacket[]>(
      "SELECT GET_LOCK(?,60) AS acquired",
      [lockName]
    );
    if (Number(locks[0]?.acquired) !== 1)
      throw new Error("Could not acquire LINE shop stock migration lock");

    await conn.beginTransaction();
    const [applied] = await conn.execute<RowDataPacket[]>(
      "SELECT migration_key FROM line_shop_migrations WHERE migration_key=? FOR UPDATE",
      [STOCK_RESET_MIGRATION]
    );
    if (!applied.length) {
      await conn.execute(
        "UPDATE line_shop_products SET stock=10 WHERE active=TRUE"
      );
      await conn.execute(
        "INSERT INTO line_shop_migrations (migration_key) VALUES (?)",
        [STOCK_RESET_MIGRATION]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.query("SELECT RELEASE_LOCK(?)", [lockName]);
    conn.release();
  }
}
async function catalog(db: Pool | PoolConnection) {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id,data_json,stock FROM line_shop_products WHERE active=TRUE ORDER BY id"
  );
  return rows
    .filter(r => !excluded.has(r.id))
    .map(r => {
      const product = parsed<ShopProduct>(r.data_json);
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
        // Descriptions are maintained in the catalog file. The database uses
        // INSERT IGNORE for stock initialization, so its product copy can lag.
        desc: customerDescriptions.get(product.id) ?? product.desc,
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
router.get(
  "/products",
  handled(async (_req, res) => {
    res.json({ products: await catalog(await database()) });
  })
);
router.use((req, res, next) => {
  if (req.method === "GET") return next();
  if (req.get("origin") !== origin())
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
    try {
      await conn.beginTransaction();
      await conn.execute(
        "INSERT INTO line_shop_orders (id,request_key,request_hash,token_hash,items_json,customer_json,subtotal,mode) VALUES (?,?,?,?,?,?,?,?)",
        [
          id,
          req.body.idempotencyKey,
          fingerprint,
          hash(req.body.token),
          JSON.stringify(resolved.items),
          JSON.stringify(customer),
          resolved.subtotalTwd,
          live() ? "live" : "test",
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
router.use("/admin", async (req, res, next) => {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role === "admin") return next();
  } catch {}
  res.status(401).json({ error: "請先以公司網站管理員帳號登入" });
});
router.get(
  "/admin/orders",
  handled(async (_req, res) => {
    const db = await database();
    const [orders] = await db.query<RowDataPacket[]>(
      "SELECT o.*, f.status AS fulfillment_status, f.tracking_number, f.shipped_at FROM line_shop_orders o LEFT JOIN line_shop_fulfillment f ON f.order_id=o.id ORDER BY o.created_at DESC LIMIT 100"
    );
    const [mail] = await db.query<RowDataPacket[]>(
      "SELECT id,order_id,kind,state,created_at FROM line_shop_mail ORDER BY id DESC LIMIT 200"
    );
    res.json({
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
    });
  })
);
router.post(
  "/admin/orders/:id/fulfillment",
  handled(async (req, res) => {
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
      if (!order) {
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
  })
);
async function preparePayment(id: string, packedWeightGrams?: unknown) {
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
    if (!order || order.mode !== (live() ? "live" : "test"))
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
      `訂單：${order!.id}\n商品小計：NT$${order!.subtotal}\nEMS運費：NT$${quote.shippingTwd}（商品滿NT$2,000運費NT$220，滿NT$5,000免運）\n總額：NT$${order!.subtotal + quote.shippingTwd}\nStripe 安全付款（24小時內有效）：${session.url}\n下單後七個工作天內從日本寄出。`
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
        const text = `訂單：${order.id}\n已付款 NT$${order.subtotal + order.shipping}（商品 NT$${order.subtotal}＋EMS運費 NT$${order.shipping}）\n${parsed<
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
