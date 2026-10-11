export type ShopProduct = {
  id: string;
  name: string;
  spec?: string;
  price: number;
  stock: number;
  catalog: string;
  [key: string]: unknown;
};
export type ShopItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPriceTwd: number;
};
export class ShopInputError extends Error {}
export const TERMS_VERSION = "2026-10-11-line-shop-v2";
export const MIN_ORDER_TWD = 2000;
export function orderShippingTwd(subtotalTwd: number) {
  if (!Number.isSafeInteger(subtotalTwd) || subtotalTwd < MIN_ORDER_TWD)
    throw new ShopInputError("商品小計需滿 NT$2,000（不含運費）");
  return subtotalTwd >= 5000 ? 0 : 220;
}
export const EMS_SOURCE =
  "https://www.post.japanpost.jp/send/oversea/charge/list-ems/all.html";
const tiers = [
  [500, 1450],
  [600, 1600],
  [700, 1750],
  [800, 1900],
  [900, 2050],
  [1000, 2200],
  [1250, 2500],
  [1500, 2800],
  [1750, 3100],
  [2000, 3400],
  [2500, 3900],
  [3000, 4400],
  [3500, 4900],
  [4000, 5400],
  [4500, 5900],
  [5000, 6400],
  [5500, 6900],
  [6000, 7400],
  [7000, 8200],
  [8000, 9000],
  [9000, 9800],
  [10000, 10600],
  [11000, 11400],
  [12000, 12200],
  [13000, 13000],
  [14000, 13800],
  [15000, 14600],
  [16000, 15400],
  [17000, 16200],
  [18000, 17000],
  [19000, 17800],
  [20000, 18600],
  [21000, 19400],
  [22000, 20200],
  [23000, 21000],
  [24000, 21800],
  [25000, 22600],
  [26000, 23400],
  [27000, 24200],
  [28000, 25000],
  [29000, 25800],
  [30000, 26600],
];
export function shippingQuote(packedWeightGrams: unknown, subtotalTwd: number) {
  if (
    !Number.isSafeInteger(packedWeightGrams) ||
    Number(packedWeightGrams) < 1 ||
    Number(packedWeightGrams) > 30000
  )
    throw new ShopInputError("整單含包材重量須為 1–30,000 克");
  const emsJpy = tiers.find(
    ([limit]) => Number(packedWeightGrams) <= limit
  )![1];
  return {
    packedWeightGrams: Number(packedWeightGrams),
    emsJpy,
    shippingTwd: orderShippingTwd(subtotalTwd),
  };
}
export function resolveShopItems(input: unknown, products: ShopProduct[]) {
  if (!Array.isArray(input) || !input.length || input.length > 99)
    throw new ShopInputError("請選擇 1–99 款商品");
  const seen = new Set<string>();
  const items: ShopItem[] = input.map(i => {
    const p = products.find(p => p.id === i?.productId);
    if (
      !p ||
      seen.has(p.id) ||
      !Number.isSafeInteger(i.quantity) ||
      i.quantity < 1 ||
      i.quantity > p.stock ||
      !Number.isSafeInteger(p.price) ||
      p.price < 1
    )
      throw new ShopInputError("商品或數量無效，請重新整理");
    seen.add(p.id);
    return {
      productId: p.id,
      name: p.name,
      quantity: i.quantity,
      unitPriceTwd: p.price,
    };
  });
  const subtotalTwd = items.reduce(
    (n, i) => n + i.unitPriceTwd * i.quantity,
    0
  );
  orderShippingTwd(subtotalTwd);
  return { items, subtotalTwd };
}
export function validPaidSession(
  session: {
    payment_status: string;
    currency: string | null;
    amount_total: number | null;
    livemode: boolean;
    metadata: Record<string, string> | null;
    client_reference_id: string | null;
  },
  order: { id: string; subtotal: number; shipping: number | null; mode: string }
) {
  return (
    Number.isSafeInteger(order.shipping) &&
    Number(order.shipping) >= 0 &&
    session.payment_status === "paid" &&
    session.currency === "twd" &&
    session.amount_total === (order.subtotal + Number(order.shipping)) * 100 &&
    session.livemode === (order.mode === "live") &&
    session.metadata?.line_shop_order === order.id &&
    session.client_reference_id === order.id
  );
}
