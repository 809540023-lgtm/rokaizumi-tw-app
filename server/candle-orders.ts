import { Router } from "express";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { sdk } from "./_core/sdk";

const router = Router();
const allowed = new Set([1, 2, 3, 5, 7, 8, 9, 10, 13, 14, 15, 16, 17, 20, 21, 25, 27, 28, 29, 30]);
const field = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;

router.get("/", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") return res.status(403).json({ error: "Access denied." });
    const db = database();
    if (!db) return res.status(503).json({ error: "Orders are temporarily unavailable." });
    await ensureNotificationTable(db);
    const [rows] = await db.query("SELECT o.id, o.created_at, o.customer_name, o.customer_email, o.customer_phone, o.street_address, o.suburb, o.state, o.postcode, o.items, o.note, o.status, n.sent_at AS notified_at FROM candle_orders o LEFT JOIN candle_order_notifications n ON n.order_id = o.id ORDER BY o.created_at DESC LIMIT 200");
    return res.json({ orders: rows });
  } catch {
    return res.status(401).json({ error: "Please sign in as an administrator." });
  }
});

let pool: mysql.Pool | undefined;
function database() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    const override = process.env.DATABASE_SSL;
    const internal = /^(localhost|127\.0\.0\.1|10\..*|192\.168\..*|172\.(1[6-9]|2\d|3[01])\..*)$/.test(url.hostname);
    pool = mysql.createPool({ uri: process.env.DATABASE_URL, ...(override === "false" || (!override && internal) ? {} : { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }) });
  }
  return pool;
}

type CandleOrder = {
  id: string; name: string; email: string; phone: string; street: string;
  suburb: string; state: string; postcode: string; items: number[]; note: string; market?: "AU" | "TW";
};

const notifyAddress = () => process.env.CANDLE_ORDER_NOTIFY_EMAIL || "info@rokaizumi-tw.jp";
const senderAddress = () => process.env.EMAIL_FROM || process.env.SMTP_USER || "ROKA IZUMI <orders@rokaizumi-tw.jp>";

// 用既有信箱寄信（Gmail 應用程式密碼、ForwardEmail 等）。三個都設了才會啟用。
function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  return { host, port, secure: process.env.SMTP_SECURE === "true" || port === 465, auth: { user, pass } };
}

let smtpTransport: ReturnType<typeof nodemailer.createTransport> | undefined;
function notificationChannelReady() {
  return Boolean(smtpConfig()) || Boolean(process.env.RESEND_API_KEY?.startsWith("re_"));
}

function orderNotificationSubject(order: CandleOrder) {
  return `新蠟燭訂單 ${order.id}｜ROKA IZUMI`;
}

function orderNotificationText(order: CandleOrder) {
  return [
    `新蠟燭訂單：${order.id}`,
    `客人：${order.name}`,
    `Email：${order.email}`,
    `電話：${order.phone}`,
    `地址：${order.street}, ${order.suburb}, ${order.state} ${order.postcode}`,
    `選擇商品：${order.items.map(n => `RZ-C${String(n === 20 ? 26 : n).padStart(3, "0")}`).join(", ")}`,
    `備註：${order.note || "無"}`,
    `市場與金額：${order.market === "TW" ? "台灣 NT$1,499" : "澳洲 A$99"}，尚未付款。請回覆客人付款資料。`,
    `訂單管理：https://rokaizumi-tw.jp/${order.market === "TW" ? "candles-tw" : "candles"}/orders/`,
  ].join("\n");
}

// SMTP 優先（可以直接用既有信箱），其次 Resend。
async function notifyNewOrder(order: CandleOrder) {
  const config = smtpConfig();
  const key = process.env.RESEND_API_KEY;
  if (!config && !(key && key.startsWith("re_"))) {
    console.error("Candle order notification is unavailable: set SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY");
    return false;
  }
  const subject = orderNotificationSubject(order);
  const text = orderNotificationText(order);
  if (config) {
    try {
      if (!smtpTransport) {
        smtpTransport = nodemailer.createTransport({
          ...config,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
        });
      }
      await smtpTransport.sendMail({ from: senderAddress(), to: notifyAddress(), subject, text });
      return true;
    } catch (error) {
      console.error("Candle order notification failed (SMTP)", error);
      smtpTransport = undefined;
      return false;
    }
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `candle-order-${order.id}` },
      body: JSON.stringify({ from: senderAddress(), to: [notifyAddress()], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("Candle order notification failed", response.status, (await response.text()).slice(0, 500));
      return false;
    }
    return true;
  } catch (error) {
    console.error("Candle order notification failed", error);
    return false;
  }
}

async function ensureNotificationTable(db: mysql.Pool) {
  await db.query("CREATE TABLE IF NOT EXISTS candle_order_notifications (order_id varchar(32) PRIMARY KEY, sent_at datetime NOT NULL)");
}

async function recordNotification(id: string) {
  const db = database();
  if (!db) return;
  await ensureNotificationTable(db);
  await db.execute("INSERT IGNORE INTO candle_order_notifications (order_id, sent_at) VALUES (?, UTC_TIMESTAMP())", [id]);
}

// Keep orders visible even when email is down, then send any missed alerts after
// the mail credentials are configured. Resend's idempotency key avoids duplicates.
async function retryPendingNotifications() {
  if (!notificationChannelReady()) return;
  const db = database();
  if (!db) return;
  try {
    await ensureNotificationTable(db);
    const [rows] = await db.query<mysql.RowDataPacket[]>(`SELECT o.id, o.customer_name, o.customer_email, o.customer_phone,
      o.street_address, o.suburb, o.state, o.postcode, o.items, o.note
      FROM candle_orders o LEFT JOIN candle_order_notifications n ON n.order_id = o.id
      WHERE n.order_id IS NULL ORDER BY o.created_at ASC LIMIT 100`);
    for (const row of rows) {
      const items = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
      const sent = await notifyNewOrder({ id: row.id, name: row.customer_name, email: row.customer_email,
        phone: row.customer_phone, street: row.street_address, suburb: row.suburb, state: row.state,
        postcode: row.postcode, items, note: row.note });
      if (!sent) break;
      await recordNotification(row.id);
    }
    await ensureTaiwanTable(db);
    const [twRows] = await db.query<mysql.RowDataPacket[]>(`SELECT o.id, o.customer_name, o.customer_email, o.customer_phone,
      o.street_address, o.suburb, o.state, o.postcode, o.items, o.note
      FROM candle_orders_tw o LEFT JOIN candle_order_notifications n ON n.order_id = o.id
      WHERE n.order_id IS NULL ORDER BY o.created_at ASC LIMIT 100`);
    for (const row of twRows) {
      const items = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
      const sent = await notifyNewOrder({ id: row.id, name: row.customer_name, email: row.customer_email,
        phone: row.customer_phone, street: row.street_address, suburb: row.suburb, state: row.state,
        postcode: row.postcode, items, note: row.note, market: "TW" });
      if (!sent) break;
      await recordNotification(row.id);
    }
  } catch (error) {
    console.error("Could not retry candle order notifications", error);
  }
}

const notificationTimer = setInterval(() => void retryPendingNotifications(), 10 * 60 * 1000);
notificationTimer.unref();
setTimeout(() => void retryPendingNotifications(), 15_000).unref();

router.post("/", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.get("content-type")?.split(";")[0] !== "application/json") return res.status(415).json({ error: "Invalid request." });
  const origin = req.get("origin");
  if (origin && origin !== `${req.protocol}://${req.get("host")}` && origin !== `https://${req.get("host")}`) return res.status(403).json({ error: "Invalid request origin." });
  if (Number(req.get("content-length")) > 8000 || JSON.stringify(req.body ?? {}).length > 8000) return res.status(413).json({ error: "Order is too long." });
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || body.company) return res.status(400).json({ error: "Invalid order." });
  const name = field(body.name, 100), email = field(body.email, 150), phone = field(body.phone, 50);
  const street = field(body.street, 200), suburb = field(body.suburb, 100), state = field(body.state, 100), postcode = field(body.postcode, 12);
  const note = body.note === "" || body.note === undefined ? "" : field(body.note, 1000);
  const items = body.items;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !street || !suburb || !state || !postcode || note === null || body.importConfirmed !== "on" || !Array.isArray(items) || items.length !== 5 || !items.every((n: unknown) => Number.isInteger(n) && allowed.has(n as number)) || new Set(items).size !== 5) {
    return res.status(400).json({ error: "Please check your five designs and all required delivery details." });
  }
  const db = database();
  if (!db) return res.status(503).json({ error: "Orders are temporarily unavailable. Please try again later." });
  const id = `RI-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS candle_orders (
      id varchar(32) PRIMARY KEY, created_at datetime NOT NULL, customer_name varchar(100) NOT NULL,
      customer_email varchar(150) NOT NULL, customer_phone varchar(50) NOT NULL,
      street_address varchar(200) NOT NULL, suburb varchar(100) NOT NULL,
      state varchar(100) NOT NULL, postcode varchar(12) NOT NULL,
      items json NOT NULL, note text NOT NULL, status varchar(32) NOT NULL
    )`);
    await db.execute("INSERT INTO candle_orders (id,created_at,customer_name,customer_email,customer_phone,street_address,suburb,state,postcode,items,note,status) VALUES (?,UTC_TIMESTAMP(),?,?,?,?,?,?,?,?,?,?)", [id, name, email, phone, street, suburb, state, postcode, JSON.stringify(items), note, "awaiting_reply"]);
    const notificationSent = await notifyNewOrder({ id, name, email, phone, street, suburb, state, postcode, items, note });
    if (notificationSent) {
      try { await recordNotification(id); } catch (error) { console.error("Could not record candle notification", error); }
    }
    return res.status(201).json({ orderNumber: id, notificationSent });
  } catch (error) {
    console.error("Could not save candle order", error);
    return res.status(503).json({ error: "Orders are temporarily unavailable. Please try again later." });
  }
});

async function ensureTaiwanTable(db: mysql.Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS candle_orders_tw (
    id varchar(32) PRIMARY KEY, created_at datetime NOT NULL, customer_name varchar(100) NOT NULL,
    customer_email varchar(150) NOT NULL, customer_phone varchar(50) NOT NULL,
    street_address varchar(200) NOT NULL, suburb varchar(100) NOT NULL,
    state varchar(100) NOT NULL, postcode varchar(12) NOT NULL,
    items json NOT NULL, note text NOT NULL, status varchar(32) NOT NULL
  )`);
}

router.get("/tw", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") return res.status(403).json({ error: "Access denied." });
    const db = database();
    if (!db) return res.status(503).json({ error: "暫時無法查詢訂單。" });
    await ensureTaiwanTable(db);
    await ensureNotificationTable(db);
    const [rows] = await db.query("SELECT o.id, o.created_at, o.customer_name, o.customer_email, o.customer_phone, o.street_address, o.suburb, o.state, o.postcode, o.items, o.note, o.status, n.sent_at AS notified_at FROM candle_orders_tw o LEFT JOIN candle_order_notifications n ON n.order_id = o.id ORDER BY o.created_at DESC LIMIT 200");
    return res.json({ orders: rows });
  } catch {
    return res.status(401).json({ error: "請先以管理員身分登入。" });
  }
});

router.post("/tw", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.get("content-type")?.split(";")[0] !== "application/json") return res.status(415).json({ error: "請使用正確的表單格式。" });
  const origin = req.get("origin");
  if (origin && origin !== `${req.protocol}://${req.get("host")}` && origin !== `https://${req.get("host")}`) return res.status(403).json({ error: "Invalid request origin." });
  if (Number(req.get("content-length")) > 8000 || JSON.stringify(req.body ?? {}).length > 8000) return res.status(413).json({ error: "訂單內容過長。" });
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || body.company || body.market !== "TW") return res.status(400).json({ error: "台灣訂單格式不正確。" });
  const name = field(body.name, 100), email = field(body.email, 150), phone = field(body.phone, 50);
  const street = field(body.street, 200), city = field(body.city, 100), region = field(body.region, 100), postcode = field(body.postcode, 12);
  const note = body.note === "" || body.note === undefined ? "" : field(body.note, 1000);
  const items = body.items;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !street || !city || !region || !/^\d{3}(\d{2})?$/.test(postcode ?? "") || note === null || body.importConfirmed !== "on" || !Array.isArray(items) || items.length !== 5 || !items.every((n: unknown) => Number.isInteger(n) && allowed.has(n as number)) || new Set(items).size !== 5) {
    return res.status(400).json({ error: "請檢查五款商品與台灣收件資料。" });
  }
  const db = database();
  if (!db) return res.status(503).json({ error: "暫時無法收單，請稍後再試。" });
  const id = `RI-TW-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  try {
    await ensureTaiwanTable(db);
    await db.execute("INSERT INTO candle_orders_tw (id,created_at,customer_name,customer_email,customer_phone,street_address,suburb,state,postcode,items,note,status) VALUES (?,UTC_TIMESTAMP(),?,?,?,?,?,?,?,?,?,?)", [id, name, email, phone, street, city, region, postcode, JSON.stringify(items), note, "awaiting_reply"]);
    const notificationSent = await notifyNewOrder({ id, name, email, phone, street, suburb: city, state: region, postcode: postcode!, items, note, market: "TW" });
    if (notificationSent) {
      try { await recordNotification(id); } catch (error) { console.error("Could not record candle notification", error); }
    }
    return res.status(201).json({ orderNumber: id, notificationSent });
  } catch (error) {
    console.error("Could not save Taiwan candle order", error);
    return res.status(503).json({ error: "暫時無法收單，請稍後再試。" });
  }
});

export default router;
