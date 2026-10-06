import { describe, it, expect } from "vitest";
import { sendPaidShopNotification, buildPaidShopNotification, type PaidShopOrder } from "./shop-notifications";

const order: PaidShopOrder = { id: "ORDER-001", mode: "live", paymentStatus: "paid", catalog: "mixed", subtotalTwd: 496, items: [{ name: "面膜", quantity: 1 }, { name: "調味料", quantity: 2 }] };

describe("paid mask and supermarket notifications", () => {
  it("does not contact Brevo for test, unpaid or refunded orders", async () => {
    const fetcher = (() => { throw new Error("must not send"); }) as typeof fetch;
    expect(await sendPaidShopNotification({ ...order, mode: "test" }, { fetcher })).toEqual({ status: "disabled_test" });
    for (const paymentStatus of ["pending", "refunded"] as const) expect(await sendPaidShopNotification({ ...order, paymentStatus }, { fetcher })).toEqual({ status: "not_paid" });
  });
  it("requires configuration and valid order data", async () => {
    expect(await sendPaidShopNotification(order, {})).toEqual({ status: "not_configured" });
    expect(await sendPaidShopNotification({ ...order, subtotalTwd: NaN }, {})).toEqual({ status: "invalid_order" });
    expect(await sendPaidShopNotification({ ...order, id: "bad\nsubject" }, {})).toEqual({ status: "invalid_order" });
  });
  it("uses the verified company sender and preserves provider acceptance ID", async () => {
    const fetcher: typeof fetch = async (_, init) => {
      const body = JSON.parse(String(init?.body));
      expect(body.sender.email).toBe("info@rokaizumi-tw.jp");
      expect(body.to).toEqual([{ email: "rokaizumi@gmail.com" }]);
      expect(body.textContent).toContain("付款後 3–5 天內出貨");
      expect(body.textContent).toContain("調味料 × 2");
      return new Response(JSON.stringify({ messageId: "test-id" }), { status: 201 });
    };
    expect(await sendPaidShopNotification(order, { apiKey: "fake-key", recipient: "rokaizumi@gmail.com", fetcher })).toEqual({ status: "accepted", messageId: "test-id" });
  });
  it("distinguishes retryable rejection from credentials and ambiguous delivery", async () => {
    for (const status of [401, 429, 500]) {
      const fetcher: typeof fetch = async () => new Response("", { status });
      expect(await sendPaidShopNotification(order, { apiKey: "fake", recipient: "test@example.com", fetcher })).toEqual({ status: "failed", retryable: status !== 401, reason: "provider_rejection", httpStatus: status });
    }
    const fetcher: typeof fetch = async () => { throw new Error("network"); };
    expect(await sendPaidShopNotification(order, { apiKey: "fake", recipient: "test@example.com", fetcher })).toEqual({ status: "failed", retryable: false, reason: "network_or_timeout" });
    expect(buildPaidShopNotification(order).subject).toContain(order.id);
  });
});
