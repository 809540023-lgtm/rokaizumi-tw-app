import { Router } from "express";
import mysql from "mysql2/promise";
import { randomUUID, createHash } from "node:crypto";
import { paypalConfigured, createPayPalCheckout, capturePayPalOrder, getPayPalOrder } from "./candle-paypal";
import nodemailer from "nodemailer";
import Stripe from "stripe";
import { sdk } from "./_core/sdk";
import { DEFAULT_PRICES, activeCandleIds, candlePrices, listCandleProducts } from "./candle-products";

const router = Router();
// 資料庫讀不到商品時的後備名單，維持原本寫死的 20 款。
const fallbackAllowed = new Set([1, 2, 3, 5, 7, 8, 9, 10, 13, 14, 15, 16, 17, 20, 21, 25, 27, 28, 29, 30]);
let prices = { ...DEFAULT_PRICES };
const staticSku = (n: number) => `RZ-C${String(n === 20 ? 26 : n).padStart(3, "0")}`;
let skuOverrides: Record<number, string> = {};

/** 後台改過的商品與售價以資料庫為準，讀不到時沿用程式內的預設值。 */
async function refreshCatalog(db: mysql.Pool) {
  try {
    prices = await candlePrices(db);
    const products = await listCandleProducts(db);
    skuOverrides = {};
    for (const p of products) {
      candleNames[p.id] = p.name;
      if (p.sku) skuOverrides[p.id] = p.sku;
    }
  } catch { /* 保持上一份可用的資料 */ }
  return activeCandleIds(db);
}
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
    const [rows] = await db.query("SELECT o.id, o.created_at, o.customer_name, o.customer_email, o.customer_phone, o.street_address, o.suburb, o.state, o.postcode, o.items, o.note, o.status, o.payment_method, n.sent_at AS notified_at FROM candle_orders o LEFT JOIN candle_order_notifications n ON n.order_id = o.id ORDER BY o.created_at DESC LIMIT 200");
    return res.json({ orders: rows });
  } catch {
    return res.status(401).json({ error: "Please sign in as an administrator." });
  }
});

// Admin only: manually confirm a bank transfer order as paid and queue the
// payment-confirmed emails (customer + merchant). Online payments (card /
// PayPal) confirm themselves through their verified flows and are rejected.
router.post("/:id/confirm-payment", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!sameOrigin(req)) return res.status(403).json({ error: "Invalid request." });
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") return res.status(403).json({ error: "Access denied." });
  } catch {
    return res.status(401).json({ error: "Please sign in as an administrator." });
  }
  const id = req.params.id;
  if (typeof id !== "string" || id.length === 0 || id.length > 32) return res.status(400).json({ error: "Invalid order number." });
  const db = database();
  if (!db) return res.status(503).json({ error: "Orders are temporarily unavailable." });
  try {
    await ensurePaidEmailTable(db);
    const [rows] = await db.execute<mysql.RowDataPacket[]>("SELECT id, status, payment_method FROM candle_orders WHERE id = ?", [id]);
    if (rows.length !== 1) return res.status(404).json({ error: "Order not found." });
    const order = rows[0];
    if (order.status === "paid") return res.status(409).json({ error: "This order is already marked as paid." });
    if (order.payment_method !== "bank_transfer") return res.status(400).json({ error: "Only bank transfer orders need manual confirmation; online payments confirm automatically." });
    if (order.status !== "awaiting_payment") return res.status(409).json({ error: "This order cannot be marked as paid." });
    await db.execute("UPDATE candle_orders SET status = 'paid' WHERE id = ? AND status = 'awaiting_payment'", [id]);
    await db.execute("INSERT IGNORE INTO candle_paid_emails (order_id, market, kind, sent_at) VALUES (?, 'AU', 'customer', NULL), (?, 'AU', 'merchant', NULL)", [id, id]);
    await retryPaidCandleEmails();
    return res.json({ orderNumber: id, status: "paid" });
  } catch (error) {
    console.error("Could not confirm candle order payment", error);
    return res.status(503).json({ error: "Could not confirm this payment. Please try again." });
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
  paymentMethod?: "bank_transfer" | "card" | "paypal";
  amount?: number; checkoutUrl?: string;
};

type CandlePaymentMethod = "bank_transfer" | "card" | "paypal";
const parsePaymentMethod = (value: unknown): CandlePaymentMethod => value === "card" || value === "paypal" ? value : "bank_transfer";
const stripeConfigured = () => {
  const key = process.env.STRIPE_SECRET_KEY || process.env.LINE_SHOP_STRIPE_SECRET_KEY;
  return Boolean(key && (process.env.STRIPE_WEBHOOK_SECRET || process.env.LINE_SHOP_STRIPE_WEBHOOK_SECRET) && (process.env.NODE_ENV !== "production" || /^(sk|rk)_live_/.test(key)));
};
const paypalAvailable = () => paypalConfigured() && (process.env.NODE_ENV !== "production" || process.env.PAYPAL_ENVIRONMENT === "live");
const onlinePaymentAvailable = (method: CandlePaymentMethod) => method === "card" ? stripeConfigured() : method === "paypal" ? paypalAvailable() : false;

const audPayment = {
  method: "bank_transfer", currency: "AUD", amount: DEFAULT_PRICES.aud, shipping: 0,
  bank: { accountHolder: "ろかいずみ合同会社", bsb: "774-001", accountNumber: "250413129", bankName: "Wise Australia Pty Ltd" },
};

const candlePrice = (market: "AU" | "TW") => market === "TW"
  ? { currency: "twd", amount: prices.twd, label: "ROKA IZUMI · 任選五款手作蠟燭" }
  : { currency: "aud", amount: prices.aud, label: "ROKA IZUMI · Five handmade candles" };
const audLabel = () => `A$${prices.aud}`;
const twdLabel = () => `NT$${prices.twd.toLocaleString("en-US")}`;

async function createCandleCheckout(order: CandleOrder, market: "AU" | "TW", receiptToken?: string) {
  const key = process.env.STRIPE_SECRET_KEY || process.env.LINE_SHOP_STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe payment is not configured");
  const stripe = new Stripe(key);
  const price = { ...candlePrice(market), ...(order.amount ? { amount: order.amount } : {}) };
  const origin = process.env.PUBLIC_BASE_URL || "https://rokaizumi-tw.jp";
  const path = market === "TW" ? "/candles-tw/" : "/candles/";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price_data: { currency: price.currency, product_data: { name: price.label }, unit_amount: price.amount * 100 }, quantity: 1 }],
    customer_email: order.email,
    billing_address_collection: "required",
    success_url: receiptToken ? `${origin}${path}?payment=success&order=${order.id}&receipt=${receiptToken}` : `${origin}${path}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: receiptToken ? `${origin}${path}?payment=cancelled&order=${order.id}&receipt=${receiptToken}` : `${origin}${path}#order`,
    metadata: { candleOrderId: order.id, candleMarket: market },
  }, { idempotencyKey: `candle-checkout-${order.id}` });
  if (!session.url || new URL(session.url).origin !== "https://checkout.stripe.com") throw new Error("Stripe checkout URL unavailable");
  return session;
}

type OnlinePayment = mysql.RowDataPacket & {
  order_id: string; market: "AU" | "TW"; method: "card" | "paypal";
  provider_id: string | null; amount_minor: number; currency: string;
  checkout_url: string | null; receipt_hash: string; capture_id: string | null;
};
const receiptHash = (token: string) => createHash("sha256").update(token).digest("hex");
async function ensureOnlinePaymentTable(db: mysql.Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS candle_online_payments (
    order_id varchar(32) PRIMARY KEY, market varchar(2) NOT NULL, method varchar(16) NOT NULL,
    provider_id varchar(255) NULL UNIQUE, amount_minor int NOT NULL, currency varchar(3) NOT NULL,
    checkout_url text NULL, receipt_hash char(64) NOT NULL, capture_id varchar(128) NULL,
    created_at datetime NOT NULL
  )`);
}
async function onlinePayment(db: mysql.Pool, orderId: string): Promise<OnlinePayment | undefined> {
  await ensureOnlinePaymentTable(db);
  const [rows] = await db.execute<OnlinePayment[]>("SELECT * FROM candle_online_payments WHERE order_id = ?", [orderId]);
  return Array.isArray(rows) ? rows[0] : undefined;
}
async function authenticatedPayment(db: mysql.Pool, orderId: unknown, token: unknown) {
  if (typeof orderId !== "string" || !/^RI-[A-F0-9]{12}$/.test(orderId) || typeof token !== "string" || !/^[a-f0-9-]{36}$/.test(token)) return;
  const payment = await onlinePayment(db, orderId);
  if (payment?.receipt_hash === receiptHash(token)) return payment;
}
async function prepareOnlineCheckout(db: mysql.Pool, order: CandleOrder, receiptToken: string) {
  const origin = process.env.PUBLIC_BASE_URL || "https://rokaizumi-tw.jp";
  let id: string; let url: string;
  if (order.paymentMethod === "paypal") {
    const result = await createPayPalCheckout({ orderId: order.id, amount: order.amount!, currency: "AUD",
      returnUrl: `${origin}/candles/?payment=paypal&order=${order.id}&receipt=${receiptToken}`,
      cancelUrl: `${origin}/candles/?payment=cancelled&order=${order.id}&receipt=${receiptToken}` });
    id = result.id; url = result.url;
  } else {
    const result = await createCandleCheckout(order, "AU", receiptToken);
    id = result.id; url = result.url!;
    await db.execute("UPDATE candle_orders SET stripe_session_id = ? WHERE id = ?", [id, order.id]);
  }
  await db.execute("UPDATE candle_online_payments SET provider_id = ?, checkout_url = ? WHERE order_id = ?", [id, url, order.id]);
  return url;
}

router.get("/payment-methods", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ card: stripeConfigured(), paypal: paypalAvailable(), bank_transfer: false });
});

const sameOrigin = (req: import("express").Request) => {
  const origin = req.get("origin");
  return !origin || origin === `${req.protocol}://${req.get("host")}` || origin === `https://${req.get("host")}`;
};

// No personal details are returned, and a random per-order token is required.
router.get("/payment-status", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const db = database();
    if (!db) return res.status(503).json({ error: "Payment verification is temporarily unavailable." });
    const payment = await authenticatedPayment(db, req.query.order, req.query.receipt);
    if (!payment) return res.status(404).json({ error: "Order payment link not found. Please check your confirmation email." });
    const [rows] = await db.execute<mysql.RowDataPacket[]>("SELECT status FROM candle_orders WHERE id = ?", [payment.order_id]);
    if (!rows[0]) return res.status(404).json({ error: "Order not found." });
    if (rows[0].status !== "paid" && payment.method === "card" && payment.provider_id && stripeConfigured()) {
      // A verified provider read also reconciles delayed webhooks, never browser-supplied status.
      const stripe = new Stripe((process.env.STRIPE_SECRET_KEY || process.env.LINE_SHOP_STRIPE_SECRET_KEY)!);
      const session = await stripe.checkout.sessions.retrieve(payment.provider_id);
      if (session.id !== payment.provider_id || session.metadata?.candleOrderId !== payment.order_id || session.metadata?.candleMarket !== payment.market) throw new Error("Stripe order binding mismatch");
      if (session.payment_status === "paid") {
        await markCandleOrderPaidByStripeSessionId(session);
        rows[0].status = "paid";
      }
    }
    res.json({ orderNumber: payment.order_id, status: rows[0].status, method: payment.method, amount: payment.amount_minor / 100, currency: payment.currency, checkoutUrl: rows[0].status === "paid" ? undefined : payment.checkout_url });
  } catch { res.status(503).json({ error: "Payment verification is temporarily unavailable. Do not pay again; please check your email or contact us with your order number." }); }
});

router.post("/checkout/resume", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!sameOrigin(req) || req.get("content-type")?.split(";")[0] !== "application/json") return res.status(403).json({ error: "Invalid request." });
  try {
    const db = database();
    if (!db) return res.status(503).json({ error: "Checkout is temporarily unavailable." });
    const payment = await authenticatedPayment(db, req.body?.order, req.body?.receipt);
    if (!payment) return res.status(404).json({ error: "Order payment link not found." });
    const [rows] = await db.execute<mysql.RowDataPacket[]>("SELECT * FROM candle_orders WHERE id = ?", [payment.order_id]);
    const row = rows[0];
    if (!row || row.status === "paid") return res.status(409).json({ error: "This order has already been paid or is unavailable. Do not pay again." });
    if (payment.checkout_url) return res.json({ checkoutUrl: payment.checkout_url });
    if (!onlinePaymentAvailable(payment.method)) return res.status(503).json({ error: "This payment method is temporarily unavailable. Please reply to your confirmation email." });
    const checkoutUrl = await prepareOnlineCheckout(db, { id: row.id, name: row.customer_name, email: row.customer_email, phone: row.customer_phone,
      street: row.street_address, suburb: row.suburb, state: row.state, postcode: row.postcode, note: row.note,
      items: typeof row.items === "string" ? JSON.parse(row.items) : row.items, market: "AU", paymentMethod: payment.method, amount: payment.amount_minor / 100 }, req.body.receipt);
    return res.json({ checkoutUrl });
  } catch { return res.status(503).json({ error: "Your order is saved. Payment is temporarily unavailable; please reply to your confirmation email. Do not place another order." }); }
});

export function verifiedPayPalCapture(result: Record<string, any>, payment: Pick<OnlinePayment, "provider_id" | "order_id" | "amount_minor" | "currency">) {
  if (result.id !== payment.provider_id || result.status !== "COMPLETED" || !Array.isArray(result.purchase_units) || result.purchase_units.length !== 1) throw new Error("PayPal order mismatch");
  const unit = result.purchase_units[0];
  if (unit.custom_id !== payment.order_id || unit.invoice_id !== payment.order_id || unit.reference_id !== payment.order_id) throw new Error("PayPal order binding mismatch");
  const captures = unit.payments?.captures;
  const expected = (payment.amount_minor / 100).toFixed(2);
  if (unit.amount?.currency_code !== payment.currency || unit.amount?.value !== expected || !Array.isArray(captures) || captures.length !== 1) throw new Error("PayPal payment amount mismatch");
  const capture = captures[0];
  if (capture.status !== "COMPLETED" || capture.final_capture !== true || typeof capture.id !== "string" || !capture.id || capture.amount?.currency_code !== payment.currency || capture.amount?.value !== expected) throw new Error("PayPal capture is not completed");
  return capture.id as string;
}

async function recordPayPalPaid(db: mysql.Pool, payment: OnlinePayment, result: Record<string, unknown>) {
  const captureId = verifiedPayPalCapture(result, payment);
  await db.execute("UPDATE candle_online_payments SET capture_id = ? WHERE order_id = ? AND provider_id = ?", [captureId, payment.order_id, payment.provider_id]);
  await ensurePaidEmailTable(db);
  await db.execute("INSERT IGNORE INTO candle_paid_emails (order_id, market, kind, sent_at) VALUES (?, 'AU', 'customer', NULL), (?, 'AU', 'merchant', NULL)", [payment.order_id, payment.order_id]);
  await db.execute("UPDATE candle_orders SET status = 'paid' WHERE id = ? AND payment_method = 'paypal'", [payment.order_id]);
  void retryPaidCandleEmails();
}

router.post("/paypal/capture", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!sameOrigin(req) || req.get("content-type")?.split(";")[0] !== "application/json") return res.status(403).json({ error: "Invalid request." });
  try {
    const db = database();
    if (!db) return res.status(503).json({ error: "Payment verification is temporarily unavailable." });
    const payment = await authenticatedPayment(db, req.body?.order, req.body?.receipt);
    if (!payment || payment.method !== "paypal" || !payment.provider_id) return res.status(404).json({ error: "PayPal order not found." });
    // Provider data is fetched server-to-server. Browser query parameters cannot mark an order paid.
    let result = await getPayPalOrder(payment.provider_id);
    if (result.status === "APPROVED") {
      try { await capturePayPalOrder(payment.provider_id, payment.order_id); }
      catch { /* Capture may have succeeded before a timeout. Reconcile below before considering a retry. */ }
      result = await getPayPalOrder(payment.provider_id);
    }
    if (result.status !== "COMPLETED") return res.status(202).json({ status: "awaiting_payment", orderNumber: payment.order_id, message: "Your payment is still being verified. Do not pay again; please check your email shortly." });
    await recordPayPalPaid(db, payment, result);
    return res.json({ status: "paid", orderNumber: payment.order_id, amount: payment.amount_minor / 100, currency: payment.currency });
  } catch { return res.status(503).json({ error: "We could not verify your PayPal payment yet. Do not pay again; please check your email or contact us with your order number." }); }
});

let paypalRetryRunning = false;
async function reconcilePendingPayPalPayments() {
  if (paypalRetryRunning || !paypalConfigured()) return;
  const db = database();
  if (!db) return;
  paypalRetryRunning = true;
  try {
    await ensureOnlinePaymentTable(db);
    const [payments] = await db.query<OnlinePayment[]>(`SELECT p.* FROM candle_online_payments p INNER JOIN candle_orders o ON o.id = p.order_id
      WHERE p.method = 'paypal' AND p.provider_id IS NOT NULL AND o.status = 'awaiting_payment' AND p.created_at > UTC_TIMESTAMP() - INTERVAL 7 DAY ORDER BY p.created_at DESC LIMIT 50`);
    for (const payment of payments) {
      try {
        const result = await getPayPalOrder(payment.provider_id!);
        if (result.status === "COMPLETED") await recordPayPalPaid(db, payment, result);
      } catch { /* Retry on the next pass. Never capture or charge in this background reconciliation. */ }
    }
  } catch { console.error("Could not reconcile pending PayPal payments"); }
  finally { paypalRetryRunning = false; }
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
  const paymentStatus = order.paymentMethod === "card" ? "等待 Stripe 信用卡付款" : order.paymentMethod === "paypal" ? "等待 PayPal 付款" : "等待銀行轉帳";
  return [
    `新蠟燭訂單：${order.id}`,
    `客人：${order.name}`,
    `Email：${order.email}`,
    `電話：${order.phone}`,
    `地址：${order.street}, ${order.suburb}, ${order.state} ${order.postcode}`,
    `選擇商品：${order.items.map(n => skuOverrides[n] || staticSku(n)).join(", ")}`,
    `備註：${order.note || "無"}`,
    order.market === "TW"
      ? `市場與金額：台灣 ${twdLabel()}。客人可選擇 Stripe 信用卡或銀行轉帳；目前${paymentStatus}。`
      : `市場與金額：澳洲 A$${order.amount ?? prices.aud}（含運）。目前${paymentStatus}。轉帳附言：${order.id}。請確認款項狀態後再開始製作並回信確認。`,
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
  const amount = order.amount ?? (order.market === "TW" ? prices.twd : prices.aud);
  if (order.market === "TW") return [
    `${order.name} 您好：`, "", "謝謝您訂購 ROKA IZUMI 手作蠟燭！",
    `已收到訂單 ${order.id}。目前尚待付款，本信不是付款收據。`,
    "", "您選擇的五款", ...order.items.map(n => `${skuOverrides[n] || staticSku(n)} · ${candleNames[n] ?? staticSku(n)}`),
    "", `總金額：${twdLabel()}，包含寄送至台灣的運費。`,
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
    ...order.items.map(n => `${skuOverrides[n] || staticSku(n)} · ${candleNames[n] ?? staticSku(n)}`),
    "", `TOTAL: A$${amount.toFixed(2)}`, "Delivery to Australia is included. No additional shipping fee.",
    "", "HOW TO PAY",
    ...(paymentMethod !== "bank_transfer" ? [
      `Your payment is processed securely by ${paymentMethod === "paypal" ? "PayPal" : "Stripe"}. Complete the checkout page to pay A$${amount.toFixed(2)}. Do not make a separate bank transfer.`,
      ...(order.checkoutUrl ? [`Continue payment: ${order.checkoutUrl}`] : ["If the payment page did not open, reply to this email for help. Please do not place another order."]),
    ] : [
      "Use a local bank transfer from your Australian banking app. No Wise account is needed.",
      "You can copy and paste the account holder, BSB, account number and transfer reference below.",
      `Account holder: ${bank.accountHolder}`, `BSB: ${bank.bsb}`, `Account number: ${bank.accountNumber}`,
      `Bank: ${bank.bankName}`, `Amount: A$${amount.toFixed(2)}`, `Transfer reference: ${order.id}`,
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
      const payment = await onlinePayment(db, row.id);
      const sent = await notifyCustomer({ amount: payment ? payment.amount_minor / 100 : undefined, checkoutUrl: payment?.checkout_url ?? undefined, id: row.id, name: row.customer_name, email: row.customer_email,
        phone: row.customer_phone, street: row.street_address, suburb: row.suburb, state: row.state,
        postcode: row.postcode, items, note: row.note, market: row.market === "TW" ? "TW" : "AU", paymentMethod: parsePaymentMethod(row.payment_method) }, parsePaymentMethod(row.payment_method));
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
      o.street_address, o.suburb, o.state, o.postcode, o.items, o.note, o.payment_method
      FROM candle_orders o LEFT JOIN candle_order_notifications n ON n.order_id = o.id
      WHERE n.order_id IS NULL ORDER BY o.created_at ASC LIMIT 100`);
    for (const row of rows) {
      const items = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
      const payment = await onlinePayment(db, row.id);
      const sent = await notifyNewOrder({ amount: payment ? payment.amount_minor / 100 : undefined, id: row.id, name: row.customer_name, email: row.customer_email,
        phone: row.customer_phone, street: row.street_address, suburb: row.suburb, state: row.state,
        postcode: row.postcode, items, note: row.note, paymentMethod: parsePaymentMethod(row.payment_method) });
      if (!sent) break;
      await recordNotification(row.id);
    }
    await ensureTaiwanTable(db);
    const [twRows] = await db.query<mysql.RowDataPacket[]>(`SELECT o.id, o.customer_name, o.customer_email, o.customer_phone,
      o.street_address, o.suburb, o.state, o.postcode, o.items, o.note, o.payment_method
      FROM candle_orders_tw o LEFT JOIN candle_order_notifications n ON n.order_id = o.id
      WHERE n.order_id IS NULL ORDER BY o.created_at ASC LIMIT 100`);
    for (const row of twRows) {
      const items = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
      const payment = await onlinePayment(db, row.id);
      const sent = await notifyNewOrder({ amount: payment ? payment.amount_minor / 100 : undefined, id: row.id, name: row.customer_name, email: row.customer_email,
        phone: row.customer_phone, street: row.street_address, suburb: row.suburb, state: row.state,
        postcode: row.postcode, items, note: row.note, market: "TW", paymentMethod: parsePaymentMethod(row.payment_method) });
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
        const designs = items.map(n => `${skuOverrides[n] || staticSku(n)} · ${candleNames[n] ?? staticSku(n)}`).join("\n");
        const merchant = mail.kind === "merchant";
        const payment = await onlinePayment(db, row.id);
        const paidAmount = payment ? payment.amount_minor / 100 : (market === "TW" ? prices.twd : prices.aud);
        const paidProvider = row.payment_method === "paypal" ? "PayPal" : row.payment_method === "bank_transfer" ? "Bank transfer" : "Stripe";
        const text = market === "TW" ? [
          `訂單 ${row.id}：付款成功`, `已確認 ${paidProvider} 付款 NT$${paidAmount.toLocaleString("en-US")}，含寄送台灣運費。`, designs,
          "確認款項後開始製作，3個工作日內完成並提供快遞單號，運送時間另計。",
          ...(merchant ? [`客戶：${row.customer_name}`, `Email：${row.customer_email}`, `電話：${row.customer_phone}`, `地址：${row.postcode} ${row.suburb}${row.state}${row.street_address}`, `備註：${row.note || "無"}`] : ["如需更正收件資料，請回覆本信並註明訂單編號。"]),
        ].join("\n") : [
          `Order ${row.id}: payment confirmed`, `Your ${paidProvider} payment of A$${paidAmount.toFixed(2)} is confirmed. Delivery to Australia is included.`, designs,
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

const retryEmails = () => { void retryPendingNotifications(); void retryPendingCustomerEmails(); void retryPaidCandleEmails(); void reconcilePendingPayPalPayments(); };
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
  if (body.paymentMethod !== undefined && !["card", "paypal", "bank_transfer"].includes(body.paymentMethod)) return res.status(400).json({ error: "Please choose an available payment method." });
  const paymentMethod = parsePaymentMethod(body.paymentMethod);
  if (!onlinePaymentAvailable(paymentMethod)) return res.status(503).json({ error: "This payment method is temporarily unavailable. Please choose another payment method." });
  const items = body.items;
  const db = database();
  if (!db) return res.status(503).json({ error: "Orders are temporarily unavailable. Please try again later." });
  const activeIds = await refreshCatalog(db);
  const allowed = activeIds.size ? activeIds : fallbackAllowed;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !street || !suburb || !state || !["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].includes(state.toUpperCase()) || !/^\d{4}$/.test(postcode ?? "") || note === null || body.importConfirmed !== "on" || !Array.isArray(items) || items.length !== 5 || !items.every((n: unknown) => Number.isInteger(n) && allowed.has(n as number)) || new Set(items).size !== 5) {
    return res.status(400).json({ error: "Please check your five designs and all required delivery details." });
  }
  const orderAmount = (await candlePrices(db)).aud;
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
    const order: CandleOrder = { id, name, email, phone, street, suburb, state, postcode: postcode!, items, note: note!, market: "AU", paymentMethod, amount: orderAmount };
    let checkoutUrl: string | undefined;
    let receiptToken: string | undefined;
    let checkoutError: string | undefined;
    if (paymentMethod !== "bank_transfer") {
      receiptToken = randomUUID();
      try {
        await ensureOnlinePaymentTable(db);
        await db.execute("INSERT INTO candle_online_payments (order_id,market,method,amount_minor,currency,receipt_hash,created_at) VALUES (?,'AU',?,?,?, ?,UTC_TIMESTAMP())", [id, paymentMethod, Math.round(order.amount! * 100), "AUD", receiptHash(receiptToken)]);
        checkoutUrl = await prepareOnlineCheckout(db, order, receiptToken);
        order.checkoutUrl = checkoutUrl;
      } catch {
        // The order is already saved. Never tell the buyer to submit a duplicate.
        checkoutError = "Your order is saved, but the payment page is temporarily unavailable. Save your order number and use the payment link to try again, or reply to your confirmation email. Do not place another order.";
      }
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
    return res.status(201).json({ orderNumber: id, notificationSent, customerEmailSent, checkoutUrl, receiptToken, checkoutError, payment: { ...audPayment, amount: orderAmount, method: paymentMethod, reference: id, status: "awaiting_payment" } });
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
  const db = database();
  if (!db) return res.status(503).json({ error: "暫時無法收單，請稍後再試。" });
  const activeIds = await refreshCatalog(db);
  const allowed = activeIds.size ? activeIds : fallbackAllowed;
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || !street || !city || !region || !/^\d{3}(\d{2})?$/.test(postcode ?? "") || note === null || body.importConfirmed !== "on" || !Array.isArray(items) || items.length !== 5 || !items.every((n: unknown) => Number.isInteger(n) && allowed.has(n as number)) || new Set(items).size !== 5) {
    return res.status(400).json({ error: "請檢查五款商品與台灣收件資料。" });
  }
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
    return res.status(201).json({ orderNumber: id, notificationSent, customerEmailSent, checkoutUrl, payment: { method: paymentMethod, currency: "TWD", amount: prices.twd, status: "awaiting_payment" } });
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
  if (session.payment_status !== "paid" || session.currency !== price.currency || !Number.isSafeInteger(session.amount_total) || session.amount_total! <= 0)
    throw new Error("Candle payment amount or status mismatch");
  const db = database();
  if (!db) throw new Error("Candle database unavailable");
  const payment = await onlinePayment(db, session.metadata.candleOrderId);
  // New checkout amounts are immutable; later catalog price edits cannot invalidate a paid order.
  const expectedAmount = payment ? Number(payment.amount_minor) : price.amount * 100;
  if (session.amount_total !== expectedAmount || (payment && (payment.method !== "card" || payment.provider_id !== session.id || payment.currency.toLowerCase() !== session.currency)))
    throw new Error("Candle payment amount or status mismatch");
  const table = market === "TW" ? "candle_orders_tw" : "candle_orders";
  const [rows] = await db.execute<mysql.RowDataPacket[]>(`SELECT id FROM ${table} WHERE id = ? AND stripe_session_id = ?`, [session.metadata.candleOrderId, session.id]);
  if (rows.length !== 1) throw new Error("Unknown candle payment session");
  await db.execute(`UPDATE ${table} SET status = 'paid' WHERE id = ? AND stripe_session_id = ?`, [session.metadata.candleOrderId, session.id]);
  await ensurePaidEmailTable(db);
  await db.execute("INSERT IGNORE INTO candle_paid_emails (order_id, market, kind, sent_at) VALUES (?, ?, 'customer', NULL), (?, ?, 'merchant', NULL)", [session.metadata.candleOrderId, market, session.metadata.candleOrderId, market]);
  void retryPaidCandleEmails();
}

export default router;
