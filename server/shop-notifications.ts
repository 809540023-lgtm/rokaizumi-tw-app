/** Prepared adapter: call only from a verified payment handler and durable outbox. */
export type PaidShopOrder = {
  id: string;
  mode: "test" | "live";
  paymentStatus: "pending" | "paid" | "refunded";
  catalog: "mask" | "supermarket" | "mixed";
  subtotalTwd: number;
  items: { name: string; quantity: number }[];
};
export type NotificationResult =
  | { status: "disabled_test" | "not_paid" | "not_configured" | "invalid_order" }
  | { status: "accepted"; messageId: string }
  | { status: "failed"; retryable: boolean; reason: "network_or_timeout" | "provider_rejection" | "ambiguous_response"; httpStatus?: number };

export function buildPaidShopNotification(order: PaidShopOrder) {
  return {
    subject: `ROKA IZUMI｜付款完成 ${order.id}`,
    textContent: [
      "面膜／超市訂單付款完成，請安排出貨。",
      `訂單編號：${order.id}`,
      `商品小計：NT$${order.subtotalTwd}`,
      ...order.items.map(item => `${item.name} × ${item.quantity}`),
      "出貨期限：付款後 3–5 天內出貨（非送達天數）。",
      "請至正式訂單管理頁查看收件資料及付款明細。",
    ].join("\n"),
  };
}

export async function sendPaidShopNotification(
  order: PaidShopOrder,
  settings: { apiKey?: string; recipient?: string; fetcher?: typeof fetch },
): Promise<NotificationResult> {
  if (order.mode !== "live") return { status: "disabled_test" };
  if (order.paymentStatus !== "paid") return { status: "not_paid" };
  if (!order.id || /[\r\n]/.test(order.id) || !Number.isSafeInteger(order.subtotalTwd) || order.subtotalTwd < 0 || !order.items.length || order.items.some(i => !i.name || !Number.isSafeInteger(i.quantity) || i.quantity < 1)) return { status: "invalid_order" };
  if (!settings.apiKey || !settings.recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.recipient)) return { status: "not_configured" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await (settings.fetcher ?? fetch)("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: controller.signal,
      headers: { "api-key": settings.apiKey, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "ろかいずみ合同会社", email: "info@rokaizumi-tw.jp" },
        to: [{ email: settings.recipient }],
        ...buildPaidShopNotification(order),
      }),
    });
    if (!response.ok) return { status: "failed", retryable: response.status === 429 || response.status >= 500, reason: "provider_rejection", httpStatus: response.status };
    const body = await response.json().catch(() => null) as { messageId?: unknown } | null;
    if (!body || typeof body.messageId !== "string" || !body.messageId) return { status: "failed", retryable: false, reason: "ambiguous_response", httpStatus: response.status };
    return { status: "accepted", messageId: body.messageId };
  } catch {
    // Delivery may have been accepted before a timeout: reconcile provider logs before retrying.
    return { status: "failed", retryable: false, reason: "network_or_timeout" };
  } finally {
    clearTimeout(timer);
  }
}
