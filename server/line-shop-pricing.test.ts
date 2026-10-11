import { describe, it, expect } from "vitest";
import {
  shippingQuote,
  resolveShopItems,
  validPaidSession,
  type ShopProduct,
} from "./line-shop-pricing";
const products = [
  { id: "M001", name: "面膜", price: 500, stock: 10, catalog: "shop" },
] as ShopProduct[];
describe("LINE shop server prices and minimum", () => {
  it("ignores a forged browser price and enforces the product subtotal", () => {
    expect(
      resolveShopItems([{ productId: "M001", quantity: 3, price: 1 }], products)
        .subtotalTwd
    ).toBe(1500);
    expect(() =>
      resolveShopItems([{ productId: "M001", quantity: 2 }], products)
    ).toThrow("1,500");
    expect(() =>
      resolveShopItems(
        [{ productId: "M001", quantity: 3 }],
        [{ ...products[0], price: 499 }]
      )
    ).toThrow("1,500");
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
describe("Taiwan EMS half share", () => {
  it("selects the next weight tier and converts only the buyer half", () => {
    expect(shippingQuote(500)).toEqual({
      packedWeightGrams: 500,
      emsJpy: 1450,
      shippingTwd: 145,
    });
    expect(shippingQuote(501).shippingTwd).toBe(160);
    expect(shippingQuote(2000).shippingTwd).toBe(340);
    expect(shippingQuote(30000).shippingTwd).toBe(2660);
  });
  it("blocks unknown, zero, fractional and excessive packed weight", () => {
    for (const w of [null, undefined, 0, -1, 1.5, 30001, "500"])
      expect(() => shippingQuote(w)).toThrow();
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
