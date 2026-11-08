import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// All mail, database and HTTP transports are replaced. No real recipient,
// payment provider or production database can be reached by these tests.
const { sendMail, query, execute, pending, paid, orders, payments } = vi.hoisted(() => ({
  sendMail: vi.fn(), query: vi.fn(), execute: vi.fn(),
  pending: [] as any[], paid: [] as any[], orders: new Map<string, any>(), payments: new Map<string, any>(),
}));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock("mysql2/promise", () => ({ default: { createPool: () => ({ query, execute }) } }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
import { customerConfirmationText, retryPaidCandleEmails, retryPendingCustomerEmails } from "./candle-orders";

const row = {
  id: "RI-PREVIEW-20261108", customer_name: "Alex Example", customer_email: "customer@example.com",
  customer_phone: "+61400000000", street_address: "1 Example Street", suburb: "Sydney",
  state: "NSW", postcode: "2000", items: [1, 2, 3, 5, 7],
  note: "Fragrance choice: A. White Floral", status: "paid", market: "AU", payment_method: "card",
};

function savePreview(name: string, mail: any) {
  if (!process.env.CANDLE_EMAIL_PREVIEW_DIR) return;
  const dir = process.env.CANDLE_EMAIL_PREVIEW_DIR;
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name + ".txt"), [
    "LOCAL TEST PREVIEW ONLY. This message was not sent.",
    `From: ${mail.from}`, `To: ${mail.to}`, `Reply-To: ${mail.replyTo}`,
    `Subject: ${mail.subject}`, "", mail.text, "",
  ].join("\n"));
  if (mail.html) writeFileSync(path.join(dir, name + ".html"), mail.html);
}

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "mysql://fake:fake@127.0.0.1:3306/fake");
  vi.stubEnv("SMTP_HOST", "mock.invalid");
  vi.stubEnv("SMTP_USER", "sender@example.com");
  vi.stubEnv("SMTP_PASS", "fake-not-a-secret");
  vi.stubEnv("EMAIL_FROM", "ROKA IZUMI <sender@example.com>");
  vi.stubEnv("CANDLE_ORDER_NOTIFY_EMAIL", "owner@example.com");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External HTTP is disabled in mail tests"); }));
  pending.length = 0; paid.length = 0; orders.clear(); payments.clear();
  sendMail.mockReset().mockImplementation(async (mail: any) => ({ accepted: [mail.to], rejected: [] }));
  query.mockReset().mockImplementation(async (sql: string, args?: any[]) => {
    if (sql.includes("INNER JOIN candle_customer_emails")) return [pending.filter(o => !o.sent), []];
    if (sql.startsWith("SELECT order_id, kind FROM candle_paid_emails")) return [paid.filter(p => p.market === args?.[0] && !p.sent), []];
    return [[], []];
  });
  execute.mockReset().mockImplementation(async (sql: string, args?: any[]) => {
    if (sql.startsWith("SELECT") && sql.includes("FROM candle_online_payments")) {
      const value = payments.get(args?.[0]);
      return [value ? [value] : [], []];
    }
    if (sql.startsWith("SELECT * FROM candle_orders")) {
      const value = orders.get(args?.[0]);
      return [value?.status === "paid" ? [value] : [], []];
    }
    if (sql.startsWith("UPDATE candle_paid_emails")) {
      const entry = paid.find(p => p.order_id === args?.[0] && p.kind === args?.[1]);
      if (entry) entry.sent = true;
    }
    if (sql.startsWith("UPDATE candle_customer_emails")) {
      const entry = pending.find(p => p.id === args?.[0]);
      if (entry) entry.sent = true;
    }
    return [{ affectedRows: 1 }, []];
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Australian candle email content (no external delivery)", () => {
  it("retries a card confirmation with the five designs, scent and delivery details", async () => {
    pending.push({ ...row, status: "awaiting_payment" });
    payments.set(row.id, { order_id: row.id, market: "AU", method: "card", amount_minor: 9900, currency: "AUD", checkout_url: "https://checkout.example.test/stripe-preview-only" });
    await retryPendingCustomerEmails();
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe("customer@example.com");
    expect(mail.replyTo).toBe("owner@example.com");
    expect(mail.subject).toContain("awaiting payment");
    for (const text of ["not a payment receipt", "A$99.00", "Delivery to Australia is included", "Stripe", "Do not make a separate bank transfer", "RZ-C001", "RZ-C002", "RZ-C003", "RZ-C005", "RZ-C007", "White Floral", "1 Example Street", "Sydney, NSW 2000", "3 business days"]) expect(mail.text).toContain(text);
    expect(mail.text).not.toContain("Account number:");
    expect(mail.html).toContain("Order confirmation");
    savePreview("customer-order-stripe", mail);
    await retryPendingCustomerEmails();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it("sends the AU paid customer and merchant notices once with the correct wording", async () => {
    orders.set(row.id, { ...row });
    paid.push({ order_id: row.id, market: "AU", kind: "customer" }, { order_id: row.id, market: "AU", kind: "merchant" });
    await retryPaidCandleEmails();
    expect(sendMail).toHaveBeenCalledTimes(2);
    for (const [mail] of sendMail.mock.calls) {
      expect(mail.subject).toContain(`Payment confirmed ${row.id}`);
      expect(mail.text).toContain("Stripe payment of A$99.00 is confirmed");
      expect(mail.text).toContain("RZ-C007");
      expect(mail.text).toContain("3 business days");
      expect(mail.text).not.toContain("awaiting payment");
      expect(mail.text).not.toContain("Account number:");
      savePreview(mail.to === "owner@example.com" ? "merchant-payment-stripe" : "customer-payment-stripe", mail);
    }
    const merchant = sendMail.mock.calls.find(([m]) => m.to === "owner@example.com")![0];
    expect(merchant.text).toContain("Customer: Alex Example");
    expect(merchant.text).toContain("Fragrance choice: A. White Floral");
    expect(merchant.text).toContain("1 Example Street, Sydney, NSW 2000");
    await retryPaidCandleEmails();
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("retries a rejected paid customer message without repeating the merchant notice", async () => {
    orders.set(row.id, { ...row });
    paid.push({ order_id: row.id, market: "AU", kind: "customer" }, { order_id: row.id, market: "AU", kind: "merchant" });
    sendMail.mockImplementation(async (mail: any) => mail.to === "customer@example.com"
      ? { accepted: [], rejected: [mail.to] } : { accepted: [mail.to], rejected: [] });
    await retryPaidCandleEmails();
    expect(paid.find(p => p.kind === "customer").sent).toBeUndefined();
    expect(paid.find(p => p.kind === "merchant").sent).toBe(true);
    sendMail.mockImplementation(async (mail: any) => ({ accepted: [mail.to], rejected: [] }));
    await retryPaidCandleEmails();
    expect(sendMail.mock.calls.map(([m]) => m.to)).toEqual(["customer@example.com", "owner@example.com", "customer@example.com"]);
  });

  it("never sends a paid receipt for an unpaid row, even when a queue entry exists", async () => {
    orders.set(row.id, { ...row, status: "awaiting_payment" });
    paid.push({ order_id: row.id, market: "AU", kind: "customer" });
    await retryPaidCandleEmails();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("escapes customer-provided HTML in the customer confirmation", async () => {
    pending.push({ ...row, customer_name: '<img src=x onerror="alert(1)">', note: "<script>alert(1)</script>" });
    await retryPendingCustomerEmails();
    const mail = sendMail.mock.calls[0][0];
    expect(mail.html).toContain("&lt;img");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
  });

  it("states the unpaid status and keeps the payment provider instructions separate", () => {
    const order = { id: row.id, name: row.customer_name, email: row.customer_email, phone: row.customer_phone, street: row.street_address, suburb: row.suburb, state: row.state, postcode: row.postcode, items: row.items, note: row.note, market: "AU" as const };
    const cardText = customerConfirmationText(order, "card");
    expect(cardText).toContain("not a payment receipt");
    expect(cardText).toContain("Stripe");
    expect(cardText).not.toContain("Account holder:");
    const bankText = customerConfirmationText(order, "bank_transfer");
    expect(bankText).toContain("No Wise account is needed");
    expect(bankText).toContain(`Transfer reference: ${row.id}`);
    expect(bankText).not.toContain("Stripe checkout");
  });

  it.each(["card", "paypal"])("preserves the saved amount and checkout link for a %s confirmation", async method => {
    pending.push({ ...row, status: "awaiting_payment", payment_method: method });
    const checkoutUrl = "https://checkout.example.test/preview-only";
    payments.set(row.id, { order_id: row.id, market: "AU", method, amount_minor: 8950, currency: "AUD", checkout_url: checkoutUrl });
    await retryPendingCustomerEmails();
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.text).toContain("TOTAL: A$89.50");
    expect(mail.text).toContain(`Continue payment: ${checkoutUrl}`);
    expect(mail.text).toContain(method === "paypal" ? "processed securely by PayPal" : "processed securely by Stripe");
    expect(mail.text).not.toContain("A$99.00");
    expect(mail.text).not.toContain("Account number:");
  });

  it("uses PayPal rather than Stripe in the AU paid receipt and preserves the charged amount", async () => {
    orders.set(row.id, { ...row, payment_method: "paypal" });
    payments.set(row.id, { order_id: row.id, market: "AU", method: "paypal", amount_minor: 7950, currency: "AUD" });
    paid.push({ order_id: row.id, market: "AU", kind: "customer" }, { order_id: row.id, market: "AU", kind: "merchant" });
    await retryPaidCandleEmails();
    expect(sendMail).toHaveBeenCalledTimes(2);
    for (const [mail] of sendMail.mock.calls) {
      expect(mail.text).toContain("Your PayPal payment of A$79.50 is confirmed");
      expect(mail.text).not.toContain("Stripe");
      expect(mail.text).not.toContain("A$99.00");
    }
  });

  it("renders a full-price PayPal confirmation and paid receipt for the review preview", async () => {
    const paypalRow = { ...row, payment_method: "paypal" };
    pending.push({ ...paypalRow, status: "awaiting_payment" });
    payments.set(row.id, { order_id: row.id, market: "AU", method: "paypal", amount_minor: 9900, currency: "AUD", checkout_url: "https://checkout.example.test/paypal-preview-only" });
    await retryPendingCustomerEmails();
    const confirmation = sendMail.mock.calls[0][0];
    expect(confirmation.text).toContain("PayPal");
    expect(confirmation.text).toContain("A$99.00");
    savePreview("customer-order-paypal", confirmation);
    orders.set(row.id, paypalRow);
    paid.push({ order_id: row.id, market: "AU", kind: "customer" });
    await retryPaidCandleEmails();
    const receipt = sendMail.mock.calls[1][0];
    expect(receipt.text).toContain("Your PayPal payment of A$99.00 is confirmed");
    savePreview("customer-payment-paypal", receipt);
  });
});
