import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
const { execute, query } = vi.hoisted(() => ({execute: vi.fn(), query: vi.fn()}));
vi.mock("./_core/sdk", () => ({sdk: {authenticateRequest: vi.fn()}}));
vi.mock("mysql2/promise", () => ({default: {createPool: () => ({execute, query})}}));
import { markCandleOrderPaidByStripeSessionId } from "./candle-orders";
const session = (market: "AU" | "TW") => ({id: "cs_paid", payment_status: "paid", currency: market === "TW" ? "twd" : "aud", amount_total: market === "TW" ? 149900 : 9900, metadata: {candleOrderId: "RI-TEST", candleMarket: market}} as unknown as Stripe.Checkout.Session);
beforeEach(() => {
  process.env.DATABASE_URL = "mysql://user:pass@127.0.0.1:3306/test";
  delete process.env.SMTP_HOST; delete process.env.RESEND_API_KEY;
  execute.mockReset().mockResolvedValue([[{id: "RI-TEST"}], []]); query.mockReset().mockResolvedValue([[], []]);
});
describe("verified candle payments", () => {
  it.each(["AU", "TW"] as const)("marks only the matching %s order and queues both receipts", async market => {
    await markCandleOrderPaidByStripeSessionId(session(market));
    const table = market === "TW" ? "candle_orders_tw" : "candle_orders";
    expect(execute).toHaveBeenCalledWith(`UPDATE ${table} SET status = 'paid' WHERE id = ? AND stripe_session_id = ?`, ["RI-TEST", "cs_paid"]);
    expect(execute.mock.calls.some(([sql]) => sql.includes("INSERT IGNORE INTO candle_paid_emails"))).toBe(true);
  });
  it("rejects wrong amounts, currency and market before any database write", async () => {
    for (const changes of [{amount_total: 1}, {currency: "jpy"}, {payment_status: "unpaid"}, {metadata: {candleOrderId: "RI-TEST", candleMarket: "UK"}}]) {
      await expect(markCandleOrderPaidByStripeSessionId({...session("TW"), ...changes} as Stripe.Checkout.Session)).rejects.toThrow();
    }
    expect(execute).not.toHaveBeenCalled();
  });
  it("does not acknowledge an unknown session or a failed database update", async () => {
    execute.mockResolvedValueOnce([[], []]);
    await expect(markCandleOrderPaidByStripeSessionId(session("AU"))).rejects.toThrow("Unknown candle payment session");
    execute.mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(markCandleOrderPaidByStripeSessionId(session("AU"))).rejects.toThrow("Database unavailable");
  });
});
