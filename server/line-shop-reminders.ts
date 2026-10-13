import type Stripe from "stripe";
export type ReminderOrder = {
  id: string;
  status: string;
  mode: string;
  session_id: string;
  subtotal: number;
  shipping: number | null;
};
export function canRemind(
  order: ReminderOrder,
  session: Stripe.Checkout.Session,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  return (
    order.status === "pending" &&
    order.mode === "live" &&
    session.livemode &&
    session.id === order.session_id &&
    session.metadata?.line_shop_order === order.id &&
    session.client_reference_id === order.id &&
    session.currency === "twd" &&
    Number.isSafeInteger(order.shipping) &&
    Number(order.shipping) >= 0 &&
    session.amount_total ===
      (Number(order.subtotal) + Number(order.shipping)) * 100 &&
    session.status === "open" &&
    session.payment_status === "unpaid" &&
    session.created <= nowSeconds - 12 * 60 * 60 &&
    session.expires_at > nowSeconds &&
    Boolean(session.url)
  );
}
export function reminderText(
  order: ReminderOrder,
  session: Stripe.Checkout.Session
) {
  const deadline = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(session.expires_at * 1000));
  return `您好，您在 ROKA IZUMI 的訂單尚未完成付款。\n\n訂單編號：${order.id}\n商品小計：NT$${order.subtotal}\n運費：NT$${order.shipping}\n待付總額：NT$${Number(order.subtotal) + Number(order.shipping)}\n\n請使用原本的 Stripe 安全付款連結完成付款：\n${session.url}\n\n付款截止：${deadline}（台灣時間）\n本提醒不會延長付款期限。連結逾期後請回到商店重新下單。\n若您剛剛已完成付款，請忽略本信。\n\n如有問題，請聯絡 info@rokaizumi-tw.jp。\nROKA IZUMI｜ろかいずみ合同会社`;
}
