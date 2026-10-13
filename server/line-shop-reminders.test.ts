import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { canRemind, reminderText } from "./line-shop-reminders";
const m = vi.hoisted(() => ({
  query: vi.fn(),
  execute: vi.fn(),
  retrieve: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
}));
vi.mock("./_core/sdk", () => ({ sdk: {} }));
vi.mock("./candle-orders", () => ({
  markCandleOrderPaidByStripeSessionId: vi.fn(),
}));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { retrieve: m.retrieve } };
  },
}));
vi.mock("mysql2/promise", () => ({
  default: { createPool: () => ({ query: m.query, execute: m.execute }) },
}));
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: m.send, close: m.close }) },
}));
import { drainShopMail } from "./line-shop";
const now = 2000000000;
const order = {
  id: "LS-reminder",
  status: "pending",
  mode: "live",
  session_id: "cs_live_reminder",
  subtotal: 2000,
  shipping: 220,
  customer_json: JSON.stringify({ email: "customer@example.com" }),
};
const session = {
  id: order.session_id,
  livemode: true,
  metadata: { line_shop_order: order.id },
  client_reference_id: order.id,
  currency: "twd",
  amount_total: 222000,
  status: "open",
  payment_status: "unpaid",
  created: now - 43200,
  expires_at: now + 43200,
  url: "https://checkout.stripe.com/c/pay/test",
} as Stripe.Checkout.Session;
let mails: any[];
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now * 1000);
  for (const [k, v] of Object.entries({
    DATABASE_URL: "mysql://localhost/shop",
    LINE_SHOP_ENABLED: "true",
    LINE_SHOP_MODE: "live",
    LINE_SHOP_STRIPE_SECRET_KEY: "sk_live_placeholder",
    LINE_SHOP_STRIPE_WEBHOOK_SECRET: "whsec_test",
    SMTP_HOST: "smtp.test",
    SMTP_USER: "test",
    SMTP_PASS: "test",
  }))
    vi.stubEnv(k, v);
  mails = [];
  m.retrieve.mockResolvedValue(session);
  m.send.mockResolvedValue({
    accepted: ["customer@example.com"],
    messageId: "msg1",
  });
  m.query.mockImplementation(async (sql: string) => {
    if (sql.includes("INNER JOIN line_shop_mail original"))
      return [[...(mails.length ? [] : [order])]];
    if (sql.startsWith("SELECT * FROM line_shop_mail"))
      return [mails.filter(x => x.state === "pending")];
    return [[]];
  });
  m.execute.mockImplementation(async (sql: string, values: any[]) => {
    if (sql.startsWith("INSERT IGNORE INTO line_shop_mail")) {
      if (!mails.some(x => x.order_id === values[0] && x.kind === values[1]))
        mails.push({
          id: 1,
          order_id: values[0],
          kind: values[1],
          recipient: values[2],
          subject: values[3],
          body: values[4],
          state: "pending",
        });
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("SELECT * FROM line_shop_orders")) return [[order]];
    const mail = mails.find(x => x.id === values.at(-1));
    if (sql.includes("state='sending'")) {
      if (mail?.state !== "pending") return [{ affectedRows: 0 }];
      mail.state = "sending";
    }
    if (mail)
      for (const state of ["cancelled", "pending", "review", "sent"])
        if (sql.includes(`state='${state}'`)) mail.state = state;
    return [{ affectedRows: 1 }];
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe("12-hour unpaid reminders", () => {
  it("does not remind before 12h or at/after expiration", () => {
    expect(canRemind(order, session, now - 1)).toBe(false);
    expect(canRemind(order, session, now)).toBe(true);
    expect(canRemind(order, session, session.expires_at)).toBe(false);
  });
  it.each(["paid", "expired"])("skips %s order records", status => {
    expect(canRemind({ ...order, status }, session, now)).toBe(false);
  });
  it("skips delayed webhook payments and completed sessions", () => {
    expect(canRemind(order, { ...session, payment_status: "paid" }, now)).toBe(
      false
    );
    expect(canRemind(order, { ...session, status: "complete" }, now)).toBe(
      false
    );
  });
  it("requires matching live session, order reference and amounts", () => {
    for (const change of [
      { id: "other" },
      { livemode: false },
      { amount_total: 1 },
      { currency: "jpy" },
      { metadata: { line_shop_order: "other" } },
      { client_reference_id: "other" },
    ])
      expect(canRemind(order, { ...session, ...change } as any, now)).toBe(
        false
      );
  });
  it("uses original checkout link and Taiwan deadline without an extension", () => {
    const text = reminderText(order, session);
    expect(text).toContain(session.url);
    expect(text).toContain("NT$2220");
    expect(text).toContain("台灣時間");
    expect(text).toContain("不會延長付款期限");
  });
  it("queues and sends only once across timer ticks", async () => {
    await drainShopMail();
    await drainShopMail();
    expect(mails).toHaveLength(1);
    expect(m.send).toHaveBeenCalledOnce();
    expect(mails[0].state).toBe("sent");
  });
  it("cancels when Stripe reports payment after queuing", async () => {
    m.retrieve
      .mockResolvedValueOnce(session)
      .mockResolvedValueOnce({
        ...session,
        payment_status: "paid",
        status: "complete",
      });
    await drainShopMail();
    expect(m.send).not.toHaveBeenCalled();
    expect(mails[0].state).toBe("cancelled");
  });
  it("retries a failed Stripe check before any SMTP attempt", async () => {
    m.retrieve
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(Error("Stripe unavailable"));
    await drainShopMail();
    expect(m.send).not.toHaveBeenCalled();
    expect(mails[0].state).toBe("pending");
    await drainShopMail();
    expect(m.send).toHaveBeenCalledOnce();
  });
  it("does not retry ambiguous SMTP failures", async () => {
    m.send.mockRejectedValue(Error("timeout"));
    await drainShopMail();
    await drainShopMail();
    expect(m.send).toHaveBeenCalledOnce();
    expect(mails[0].state).toBe("review");
  });
  it("suppresses all reminders in test mode", async () => {
    vi.stubEnv("LINE_SHOP_MODE", "test");
    await drainShopMail();
    expect(m.retrieve).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });
});
