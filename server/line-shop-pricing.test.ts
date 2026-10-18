import { describe, it, expect } from "vitest";
import {
  shippingQuote,
  orderShippingTwd,
  resolveShopItems,
  validPaidSession,
  type ShopProduct,
} from "./line-shop-pricing";
const products = [
  { id: "M001", name: "面膜", price: 500, stock: 10, catalog: "shop" },
  { id: "EXC002", name: "市田柿", price: 799, stock: 120, catalog: "exclusive", freeShipping: true },
] as ShopProduct[];
describe("LINE shop server prices and minimum", () => {
  it("ignores a forged browser price and enforces the product subtotal", () => {
    expect(
      resolveShopItems([{ productId: "M001", quantity: 4, price: 1 }], products)
        .subtotalTwd
    ).toBe(2000);
    expect(() =>
      resolveShopItems([{ productId: "M001", quantity: 2 }], products)
    ).toThrow("2,000");
    expect(() =>
      resolveShopItems(
        [{ productId: "M001", quantity: 4 }],
        [{ ...products[0], price: 499 }]
      )
    ).toThrow("2,000");
  });
  it("allows the shipping-exempt Ichida-gaki below the normal minimum", () => {
    expect(resolveShopItems([{ productId: "EXC002", quantity: 1 }], products)).toMatchObject({
      subtotalTwd: 799,
      shippingSubtotalTwd: 0,
      items: [{ freeShipping: true }],
    });
    expect(resolveShopItems([
      { productId: "M001", quantity: 4 },
      { productId: "EXC002", quantity: 1 },
    ], products).shippingSubtotalTwd).toBe(2000);
    expect(() => resolveShopItems([
      { productId: "M001", quantity: 2 },
      { productId: "EXC002", quantity: 1 },
    ], products)).toThrow("2,000");
  });
  it("rejects duplicate, removed, fractional and out of stock items", () => {
    for (const items of [
      [{ productId: "missing", quantity: 3 }],
      [{ productId: "M001", quantity: 3.5 }],
      [{ productId: "M001", quantity: 11 }],
      [
        { productId: "M001", quantity: 2 },
        { productId: "M001", quantity: 2 },
      ],
    ])
      expect(() => resolveShopItems(items, products)).toThrow();
  });
});
describe("Taiwan fixed postage and free shipping", () => {
  it("enforces the minimum and both shipping boundaries", () => {
    expect(() => orderShippingTwd(1999)).toThrow("2,000");
    expect(orderShippingTwd(2000)).toBe(220);
    expect(orderShippingTwd(4999)).toBe(220);
    expect(orderShippingTwd(5000)).toBe(0);
    expect(orderShippingTwd(5001)).toBe(0);
  });
  it("records carrier cost without changing buyer postage", () => {
    expect(shippingQuote(500, 2000)).toEqual({
      packedWeightGrams: 500,
      emsJpy: 1450,
      shippingTwd: 220,
    });
    expect(shippingQuote(501, 4999).shippingTwd).toBe(220);
    expect(shippingQuote(2000, 5000).shippingTwd).toBe(0);
    expect(shippingQuote(30000, 5000).shippingTwd).toBe(0);
  });
  it("blocks unknown, zero, fractional and excessive packed weight", () => {
    for (const w of [null, undefined, 0, -1, 1.5, 30001, "500"])
      expect(() => shippingQuote(w, 2000)).toThrow();
  });
});
describe("verified Stripe payment amount and mode", () => {
  const order = { id: "RZ-1", subtotal: 1500, shipping: 145, mode: "live" };
  const session = {
    payment_status: "paid",
    currency: "twd",
    amount_total: 164500,
    livemode: true,
    metadata: { line_shop_order: "RZ-1" },
    client_reference_id: "RZ-1",
  };
  it("accepts a matching full TWD payment", () =>
    expect(validPaidSession(session, order)).toBe(true));
  it("accepts free shipping and rejects an underpayment", () => {
    const free = { ...order, subtotal: 5000, shipping: 0 };
    expect(validPaidSession({ ...session, amount_total: 500000 }, free)).toBe(true);
    expect(validPaidSession({ ...session, amount_total: 499900 }, free)).toBe(false);
    expect(validPaidSession(session, { ...order, shipping: null })).toBe(false);
  });
  it("rejects unpaid, wrong amount, wrong currency, test and another order", () => {
    for (const overrides of [
      { payment_status: "unpaid" },
      { amount_total: 150000 },
      { currency: "jpy" },
      { livemode: false },
      { metadata: { line_shop_order: "RZ-2" } },
      { client_reference_id: "RZ-2" },
    ])
      expect(validPaidSession({ ...session, ...overrides }, order)).toBe(false);
  });
});
