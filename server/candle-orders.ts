import { Router } from "express";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import Stripe from "stripe";
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
  paymentMethod?: "bank_transfer" | "card";
};

type CandlePaymentMethod = "bank_transfer" | "card";

const audPayment = {
  method: "bank_transfer", currency: "AUD", amount: 99, shipping: 0,
  bank: { accountHolder: "ろかいずみ合同会社", bsb: "774-001", accountNumber: "250413129", bankName: "Wise Australia Pty Ltd" },
};

const candlePrice = (market: "AU" | "TW") => market === "TW"
  ? { currency: "twd", amount: 1499, label: "ROKA IZUMI · 任選五款手作蠟燭" }
  : { currency: "aud", amount: 99, label: "ROKA IZUMI · Five handmade candles" };

async function createCandleCheckout(order: CandleOrder, market: "AU" | "TW") {
  const key = process.env.STRIPE_SECRET_KEY || process.env.LINE_SHOP_STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe payment is not configured");
  const stripe = new Stripe(key);
  const price = candlePrice(market);
  const origin = process.env.PUBLIC_BASE_URL || "https://rokaizumi-tw.jp";
  const path = market === "TW" ? "/candles-tw/" : "/candles/";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price_data: { currency: price.currency, product_data: { name: price.label }, unit_amount: price.amount * 100 }, quantity: 1 }],
    customer_email: order.email,
    billing_address_collection: "required",
    success_url: `${origin}${path}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${path}#order`,
    metadata: { candleOrderId: order.id, candleMarket: market },
  });
  return session;
}

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
  const paymentStatus = order.paymentMethod === "card" ? "等待 Stripe 信用卡付款" : "等待銀行轉帳";
  return [
    `新蠟燭訂單：${order.id}`,
    `客人：${order.name}`,
    `Email：${order.email}`,
    `電話：${order.phone}`,
    `地址：${order.street}, ${order.suburb}, ${order.state} ${order.postcode}`,
    `選擇商品：${order.items.map(n => `RZ-C${String(n === 20 ? 26 : n).padStart(3, "0")}`).join(", ")}`,
    `備註：${order.note || "無"}`,
    order.market === "TW"
      ? `市場與金額：台灣 NT$1,499。客人可選擇 Stripe 信用卡或銀行轉帳；目前${paymentStatus}。`
      : `市場與金額：澳洲 A$99（含運）。客人可選擇 Stripe 信用卡或 Wise AUD 銀行轉帳；目前${paymentStatus}。轉帳附言：${order.id}。請確認款項狀態後再開始製作並回信確認。`,
    `訂單管理：https://rokaizumi-tw.jp/${order.market === "TW" ? "candles-tw" : "candles"}/orders/`,
  ].join("\n");
}

// SMTP 優先（可以直接用既有信箱），其次 Resend。
async function sendOrderEmail(to: string, subject: string, text: string, keySuffix: string, html?: string) {
  const config = smtpConfig();
  const key = process.env.RESEND_API_KEY;
  if (!config && !(key && key.startsWith("re_"))) {
    console.error("Candle order notification is unavailable: set SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY");
    return false;
  }
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
      const result = await smtpTransport.sendMail({ from: senderAddress(), to, replyTo: notifyAddress(), subject, text, html });
      return Boolean(result.accepted?.length) && !result.rejected?.length;
    } catch (error) {
      console.error("Candle order notification failed (SMTP)", error);
      smtpTransport = undefined;
      return false;
    }
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `candle-order-${keySuffix}` },
      body: JSON.stringify({ from: senderAddress(), to: [to], reply_to: notifyAddress(), subject, text, html }),
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

async function notifyNewOrder(order: CandleOrder) {
  return sendOrderEmail(notifyAddress(), orderNotificationSubject(order), orderNotificationText(order), order.id);
}

const candleNames: Record<number, string> = {
  1: "Elephant", 2: "Golden Retriever Pair (2 dogs)", 3: "Puppy in Egg", 5: "Iced Latte",
  7: "Strawberry Shake", 8: "Cherry Shake", 9: "Pineapple Juice", 10: "Passion Fruit Drink",
  13: "Green Jelly", 14: "Blue Jelly", 15: "Grey & White Flowers", 16: "Floral Tower 1",
  17: "Floral Tower 2", 20: "Christmas Snowman & Trees", 21: "Macaron Dessert Bowl",
  25: "Sleeping Bear & Chocolate", 27: "Fruit & Flower Cake", 28: "Strawberry Cake",
  29: "Knitted Mitten + Yarn Ball (1 of each)", 30: "Rose Ball (1 candle · random colour)",
};

export function customerConfirmationText(order: CandleOrder, paymentMethod: CandlePaymentMethod = "bank_transfer") {
  if (order.market === "TW") return [
    `${order.name} 您好：`, "", "謝謝您訂購 ROKA IZUMI 手作蠟燭！",
    `已收到訂單 ${order.id}。目前尚待付款，本信不是付款收據。`,
    "", "您選擇的五款", ...order.items.map(n => `RZ-C${String(n === 20 ? 26 : n).padStart(3, "0")} · ${candleNames[n]}`),
    "", "總金額：NT$1,499，包含寄送至台灣的運費。",
    paymentMethod === "card"
      ? "請在下單後開啟的 Stripe 結帳頁完成信用卡／金融卡付款，無須另外銀行轉帳。"
      : "您選擇銀行轉帳；我們會另以 Email 提供付款資料。收到付款資料前請勿自行匯款。",
    "", "收件資料", order.name, `${order.postcode} ${order.suburb}${order.state}${order.street}`, `電話：${order.phone}`,
    ...(order.note ? [`備註：${order.note}`] : []),
    "", "確認款項後開始製作，並在3個工作日內完成、提供快遞單號，運送時間另計。",
    "顏色隨機，恕無法指定。雙狗組算一款；RZ-C029為手套與毛線球各一，RZ-C030為單顆。",
    "如需更正資料，請直接回覆本信並註明訂單編號，無須重複下單。",
    "", "ROKA IZUMI · 日本大阪手作", "https://rokaizumi-tw.jp/candles-tw/",
  ].join("\n");
  const bank = audPayment.bank;
  return [
    `Hi ${order.name},`, "", "Thank you for choosing ROKA IZUMI handmade candles!",
    `We have received your order ${order.id}. Your order is awaiting payment — this email is not a payment receipt.`,
    "", "YOUR FIVE DESIGNS",
    ...order.items.map(n => `RZ-C${String(n === 20 ? 26 : n).padStart(3, "0")} · ${candleNames[n]}`),
    "", "TOTAL: A$99.00", "Delivery to Australia is included. No additional shipping fee.",
    "", "HOW TO PAY",
    ...(paymentMethod === "card" ? [
      "Your card payment is processed securely by Stripe. Complete the Stripe checkout page to pay A$99.00. Do not make a separate bank transfer.",
    ] : [
      "Use a local bank transfer from your Australian banking app. No Wise account is needed.",
      "You can copy and paste the account holder, BSB, account number and transfer reference below.",
      `Account holder: ${bank.accountHolder}`, `BSB: ${bank.bsb}`, `Account number: ${bank.accountNumber}`,
      `Bank: ${bank.bankName}`, "Amount: A$99.00", `Transfer reference: ${order.id}`,
      "Please include your order number as the transfer reference so we can match your payment.",
    ]),
    "", "DELIVERY DETAILS", order.name, order.street, `${order.suburb}, ${order.state} ${order.postcode}`, "Australia",
    `Contact phone: ${order.phone}`, ...(order.note ? [`Delivery note: ${order.note}`] : []),
    "", "WHAT HAPPENS NEXT",
    "We will confirm receipt by email after checking that your payment has reached our account.",
    "Production begins after payment is received. We will complete your set and provide a courier tracking number within 3 business days of receiving payment. Delivery time is additional.",
    "", "HANDMADE COLOURS",
    "Every candle is handmade. Colours and small details vary and cannot be identical to the photos or another set. Colours are selected at random; specific colours cannot be requested.",
    "The Golden Retriever Pair includes two dogs and counts as one design. RZ-C029 includes one mitten and one yarn ball. RZ-C030 is one candle in a random colour.",
    "", "Australian customs or the carrier may contact you for import clearance. Any import taxes or local charges assessed are payable by the recipient.",
    "", "Questions or corrections to your delivery details? Reply to this email and quote your order number. Please do not place another order for the same set.",
    "", "Thank you,", "ROKA IZUMI · Handmade in Osaka, Japan", "https://rokaizumi-tw.jp/candles/",
  ].join("\n");
}

const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));

async function notifyCustomer(order: CandleOrder, paymentMethod: CandlePaymentMethod = "bank_transfer") {
  const text = customerConfirmationText(order, paymentMethod);
  const heading = order.market === "TW" ? "訂單確認 — 尚待付款" : "Order confirmation — awaiting payment";
  const html = `<div style="max-width:640px;margin:auto;padding:24px;font:16px/1.65 Arial,sans-serif;color:#302a29"><h1 style="font:28px Georgia,serif">ROKA IZUMI</h1><h2 style="font-size:20px">${heading}</h2><div style="white-space:pre-wrap">${escapeEmailHtml(text).replace(/\n/g, "<br>")}</div></div>`;
  return sendOrderEmail(order.email, order.market === "TW" ? `ROKA IZUMI｜訂單 ${order.id} — 尚待付款` : `ROKA IZUMI | Order ${order.id} — awaiting payment`, text, `${order.id}-customer`, html);
}

// Only newly queued orders are enrolled; deployment never emails historical customers.
async function ensureCustomerEmailTable(db: mysql.Pool) {
  await db.query("CREATE TABLE IF NOT EXISTS candle_customer_emails (order_id varchar(32) PRIMARY KEY, created_at datetime NOT NULL, sent_at datetime NULL)");
}

async function recordCustomerEmail(db: mysql.Pool, id: string) {
  await db.execute("UPDATE candle_customer_emails SET sent_at = UTC_TIMESTAMP() WHERE order_id = ? AND sent_at IS NULL", [id]);
}

let customerRetryRunning = false;
export async function retryPendingCustomerEmails() {
  if (customerRetryRunning) return;
  if (!notificationChannelReady()) return;
  const db = database();
  if (!db) return;
  customerRetryRunning = true;
  try {
    await ensureCustomerEmailTable(db);
    await ensureTaiwanTable(db);
    const [rows] = await db.query<mysql.RowDataPacket[]>(`SELECT o.id, o.customer_name, o.customer_email, o.customer_phone,
      o.street_address, o.suburb, o.state, o.postcode, o.items, o.note, o.payment_method, 'AU' AS market
      FROM candle_orders o INNER JOIN candle_customer_emails c ON c.order_id = o.id
      WHERE c.sent_at IS NULL AND o.status = 'awaiting_payment' AND c.created_at < UTC_TIMESTAMP() - INTERVAL 2 MINUTE
      UNION ALL
      SELECT o.id, o.customer_name, o.customer_email, o.customer_phone,
      o.street_address, o.suburb, o.state, o.postcode, o.items, o.note, o.payment_method, 'TW' AS market
      FROM candle_orders_tw o INNER JOIN candle_customer_emails c ON c.order_id = o.id
      WHERE c.sent_at IS NULL AND o.status IN ('awaiting_payment', 'awaiting_reply') AND c.created_at < UTC_TIMESTAMP() - INTERVAL 2 MINUTE
      LIMIT 100`);
    for (const row of rows) {
      const items = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
      const sent = await notifyCustomer({ id: row.id, name: row.customer_name, email: row.customer_email,
        phone: row.customer_phone, street: row.street_address, suburb: row.suburb, state: row.state,
        postcode: row.postcode, items, note: row.note, market: row.market === "TW" ? "TW" : "AU", paymentMethod: row.payment_method === "card" ? "card" : "bank_transfer" }, row.payment_method === "card" ? "card" : "bank_transfer");
      if (sent) await recordCustomerEmail(db, row.id);
    }
  } catch (error) {
    console.error("Could not retry customer candle emails", error);
  } finally {
    customerRetryRunning = false;
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

async function ensurePaidEmailTable(db: mysql.Pool) {
  await db.query("CREATE TABLE IF NOT EXISTS candle_paid_emails (order_id varchar(32) NOT NULL, market varchar(2) NOT NULL, kind varchar(10) NOT NULL, sent_at datetime NULL, PRIMARY KEY (order_id, kind))");
}

let paidRetryRunning = false;
export async function retryPaidCandleEmails() {
  if (paidRetryRunning || !notificationChannelReady()) return;
  const db = database();
  if (!db) return;
  paidRetryRunning = true;
  try {
    await ensurePaidEmailTable(db);
    for (const market of ["AU", "TW"] as const) {
      const table = market === "TW" ? "candle_orders_tw" : "candle_orders";
      // Only rows enrolled by a verified payment are considered, never historical orders.
      const [queued] = await db.query<mysql.RowDataPacket[]>("SELECT order_id, kind FROM candle_paid_emails WHERE market = ? AND sent_at IS NULL LIMIT 100", [market]);
      for (const mail of queued) {
        const [rows] = await db.execute<mysql.RowDataPacket[]>(`SELECT * FROM ${table} WHERE id = ? AND status = 'paid'`, [mail.order_id]);
        if (rows.length !== 1) continue;
        const row = rows[0];
        const items: number[] = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
        const designs = items.map(n => `RZ-C${String(n === 20 ? 26 : n).padStart(3, "0")} · ${candleNames[n]}`).join("\n");
        const merchant = mail.kind === "merchant";
        const text = market === "TW" ? [
          `訂單 ${row.id}：付款成功`, "已確認 Stripe 付款 NT$1,499，含寄送台灣運費。", designs,
          "確認款項後開始製作，3個工作日內完成並提供快遞單號，運送時間另計。",
          ...(merchant ? [`客戶：${row.customer_name}`, `Email：${row.customer_email}`, `電話：${row.customer_phone}`, `地址：${row.postcode} ${row.suburb}${row.state}${row.street_address}`, `備註：${row.note || "無"}`] : ["如需更正收件資料，請回覆本信並註明訂單編號。"]),
        ].join("\n") : [
          `Order ${row.id}: payment confirmed`, "Your Stripe payment of A$99.00 is confirmed. Delivery to Australia is included.", designs,
          "Production begins after payment. We will complete your set and provide a courier tracking number within 3 business days. Delivery time is additional.",
          ...(merchant ? [`Customer: ${row.customer_name}`, `Email: ${row.customer_email}`, `Phone: ${row.customer_phone}`, `Address: ${row.street_address}, ${row.suburb}, ${row.state} ${row.postcode}`, `Note: ${row.note || "None"}`] : ["Reply to this email with your order number if you need to correct your delivery details."]),
        ].join("\n");
        const sent = await sendOrderEmail(merchant ? notifyAddress() : row.customer_email,
          market === "TW" ? `ROKA IZUMI｜付款成功 ${row.id}` : `ROKA IZUMI | Payment confirmed ${row.id}`,
          text, `${row.id}-paid-${mail.kind}`);
        if (sent) await db.execute("UPDATE candle_paid_emails SET sent_at = UTC_TIMESTAMP() WHERE order_id = ? AND kind = ? AND sent_at IS NULL", [row.id, mail.kind]);
      }
    }
  } catch (error) { console.error("Could not retry paid candle emails", error); }
  finally { paidRetryRunning = false; }
}

const retryEmails = () => { void retryPendingNotifications(); void retryPendingCustomerEmails(); void retryPaidCandleEmails(); };
const notificationTimer = setInterval(retryEmails, 10 * 60 * 1000);
notificationTimer.unref();
setTimeout(retryEmails, 15_000).unref();

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
  const paymentMethod: CandlePaymentMethod = body.paymentMethod === "card" ? "card" : "bank_transfer";
  const items = body.items;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !street || !suburb || !state || !["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].includes(state.toUpperCase()) || !/^\d{4}$/.test(postcode ?? "") || note === null || body.importConfirmed !== "on" || !Array.isArray(items) || items.length !== 5 || !items.every((n: unknown) => Number.isInteger(n) && allowed.has(n as number)) || new Set(items).size !== 5) {
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
      items json NOT NULL, note text NOT NULL, status varchar(32) NOT NULL,
      payment_method varchar(32) NOT NULL DEFAULT 'bank_transfer', stripe_session_id varchar(255) NULL
    )`);
    try { await db.query("ALTER TABLE candle_orders ADD COLUMN payment_method varchar(32) NOT NULL DEFAULT 'bank_transfer'"); } catch { /* existing column */ }
    try { await db.query("ALTER TABLE candle_orders ADD COLUMN stripe_session_id varchar(255) NULL"); } catch { /* existing column */ }
    await db.execute("INSERT INTO candle_orders (id,created_at,customer_name,customer_email,customer_phone,street_address,suburb,state,postcode,items,note,payment_method,status) VALUES (?,UTC_TIMESTAMP(),?,?,?,?,?,?,?,?,?,?,?)", [id, name, email, phone, street, suburb, state, postcode, JSON.stringify(items), note, paymentMethod, "awaiting_payment"]);
    const order: CandleOrder = { id, name, email, phone, street, suburb, state, postcode: postcode!, items, note: note!, market: "AU", paymentMethod };
    let checkoutUrl: string | undefined;
    if (paymentMethod === "card") {
      const session = await createCandleCheckout(order, "AU");
      checkoutUrl = session.url ?? undefined;
      await db.execute("UPDATE candle_orders SET stripe_session_id = ? WHERE id = ?", [session.id, id]);
    }
    let customerEmailQueued = false;
    try {
      await ensureCustomerEmailTable(db);
      await db.execute("INSERT INTO candle_customer_emails (order_id, created_at, sent_at) VALUES (?, UTC_TIMESTAMP(), NULL)", [id]);
      customerEmailQueued = true;
    } catch (error) { console.error("Could not queue customer candle email", error); }
    const [notificationSent, customerEmailSent] = await Promise.all([notifyNewOrder(order), notifyCustomer(order, paymentMethod)]);
    if (customerEmailSent && customerEmailQueued) {
      try { await recordCustomerEmail(db, id); } catch (error) { console.error("Could not record customer candle email", error); }
    }
    if (notificationSent) {
      try { await recordNotification(id); } catch (error) { console.error("Could not record candle notification", error); }
    }
    return res.status(201).json({ orderNumber: id, notificationSent, customerEmailSent, checkoutUrl, payment: { ...audPayment, method: paymentMethod, reference: id, status: "awaiting_payment" } });
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
    items json NOT NULL, note text NOT NULL, status varchar(32) NOT NULL,
    payment_method varchar(32) NOT NULL DEFAULT 'bank_transfer', stripe_session_id varchar(255) NULL
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
  const paymentMethod: CandlePaymentMethod = body.paymentMethod === "card" ? "card" : "bank_transfer";
  const items = body.items;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !street || !city || !region || !/^\d{3}(\d{2})?$/.test(postcode ?? "") || note === null || body.importConfirmed !== "on" || !Array.isArray(items) || items.length !== 5 || !items.every((n: unknown) => Number.isInteger(n) && allowed.has(n as number)) || new Set(items).size !== 5) {
    return res.status(400).json({ error: "請檢查五款商品與台灣收件資料。" });
  }
  const db = database();
  if (!db) return res.status(503).json({ error: "暫時無法收單，請稍後再試。" });
  const id = `RI-TW-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  try {
    await ensureTaiwanTable(db);
    try { await db.query("ALTER TABLE candle_orders_tw ADD COLUMN payment_method varchar(32) NOT NULL DEFAULT 'bank_transfer'"); } catch { /* existing column */ }
    try { await db.query("ALTER TABLE candle_orders_tw ADD COLUMN stripe_session_id varchar(255) NULL"); } catch { /* existing column */ }
    await db.execute("INSERT INTO candle_orders_tw (id,created_at,customer_name,customer_email,customer_phone,street_address,suburb,state,postcode,items,note,payment_method,status) VALUES (?,UTC_TIMESTAMP(),?,?,?,?,?,?,?,?,?,?,?)", [id, name, email, phone, street, city, region, postcode, JSON.stringify(items), note, paymentMethod, paymentMethod === "card" ? "awaiting_payment" : "awaiting_reply"]);
    const order: CandleOrder = { id, name, email, phone, street, suburb: city, state: region, postcode: postcode!, items, note, market: "TW", paymentMethod };
    let checkoutUrl: string | undefined;
    if (paymentMethod === "card") {
      const session = await createCandleCheckout(order, "TW");
      checkoutUrl = session.url ?? undefined;
      await db.execute("UPDATE candle_orders_tw SET stripe_session_id = ? WHERE id = ?", [session.id, id]);
    }
    let customerEmailQueued = false;
    try {
      await ensureCustomerEmailTable(db);
      await db.execute("INSERT INTO candle_customer_emails (order_id, created_at, sent_at) VALUES (?, UTC_TIMESTAMP(), NULL)", [id]);
      customerEmailQueued = true;
    } catch (error) { console.error("Could not queue Taiwan customer candle email", error); }
    const [notificationSent, customerEmailSent] = await Promise.all([notifyNewOrder(order), notifyCustomer(order, paymentMethod)]);
    if (customerEmailSent && customerEmailQueued) {
      try { await recordCustomerEmail(db, id); } catch (error) { console.error("Could not record Taiwan customer candle email", error); }
    }
    if (notificationSent) {
      try { await recordNotification(id); } catch (error) { console.error("Could not record candle notification", error); }
    }
    return res.status(201).json({ orderNumber: id, notificationSent, customerEmailSent, checkoutUrl, payment: { method: paymentMethod, currency: "TWD", amount: 1499, status: "awaiting_payment" } });
  } catch (error) {
    console.error("Could not save Taiwan candle order", error);
    return res.status(503).json({ error: "暫時無法收單，請稍後再試。" });
  }
});

// Called only after Stripe signature verification by either supported endpoint.
export async function markCandleOrderPaidByStripeSessionId(session: Stripe.Checkout.Session) {
  if (!session.metadata?.candleOrderId) return;
  const market = session.metadata.candleMarket;
  if (market !== "AU" && market !== "TW") throw new Error("Invalid candle market");
  const price = candlePrice(market);
  if (session.payment_status !== "paid" || session.currency !== price.currency || session.amount_total !== price.amount * 100)
    throw new Error("Candle payment amount or status mismatch");
  const db = database();
  if (!db) throw new Error("Candle database unavailable");
  const table = market === "TW" ? "candle_orders_tw" : "candle_orders";
  const [rows] = await db.execute<mysql.RowDataPacket[]>(`SELECT id FROM ${table} WHERE id = ? AND stripe_session_id = ?`, [session.metadata.candleOrderId, session.id]);
  if (rows.length !== 1) throw new Error("Unknown candle payment session");
  await db.execute(`UPDATE ${table} SET status = 'paid' WHERE id = ? AND stripe_session_id = ?`, [session.metadata.candleOrderId, session.id]);
  await ensurePaidEmailTable(db);
  await db.execute("INSERT IGNORE INTO candle_paid_emails (order_id, market, kind, sent_at) VALUES (?, ?, 'customer', NULL), (?, ?, 'merchant', NULL)", [session.metadata.candleOrderId, market, session.metadata.candleOrderId, market]);
  void retryPaidCandleEmails();
}

export default router;
