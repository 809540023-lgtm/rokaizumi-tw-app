import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("mysql2/promise", () => ({
  default: { createPool: () => ({ query: vi.fn(), getConnection: vi.fn() }) },
}));

import { SHOP_CATALOGS } from "./line-shop";
import {
  CATALOG_LABELS,
  parsePrice,
  parseStock,
  shopBotAdminIds,
  summaryText,
} from "./line-shop-telegram";

afterEach(() => vi.unstubAllEnvs());

describe("parsePrice", () => {
  it("接受純數字與常見寫法", () => {
    expect(parsePrice("150")).toBe(150);
    expect(parsePrice(" 99 ")).toBe(99);
    expect(parsePrice("NT$150")).toBe(150);
    expect(parsePrice("1,200元")).toBe(1200);
    expect(parsePrice("100000")).toBe(100000);
  });

  it("擋掉空白、文字、0、小數與超出上限", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice("abc")).toBeNull();
    expect(parsePrice("0")).toBeNull();
    expect(parsePrice("1.5")).toBeNull();
    expect(parsePrice("-5")).toBeNull();
    expect(parsePrice("100001")).toBeNull();
  });
});

describe("parseStock", () => {
  it("0 是合法庫存（先不開賣）", () => {
    expect(parseStock("0")).toBe(0);
    expect(parseStock("12")).toBe(12);
    expect(parseStock("1,000")).toBe(1000);
  });

  it("擋掉負數、小數與文字", () => {
    expect(parseStock("")).toBeNull();
    expect(parseStock("-1")).toBeNull();
    expect(parseStock("1.5")).toBeNull();
    expect(parseStock("abc")).toBeNull();
    expect(parseStock("100001")).toBeNull();
  });
});

describe("CATALOG_LABELS", () => {
  it("商店首頁的四個分區都有對應名稱", () => {
    expect(Object.keys(CATALOG_LABELS).sort()).toEqual([...SHOP_CATALOGS].sort());
  });
});

describe("summaryText", () => {
  it("列出已填欄位，照片沒傳時標成未上傳", () => {
    const text = summaryText({
      step: "confirm",
      catalog: "shop",
      name: "測試商品",
      price: 250,
      stock: 3,
      desc: "一句話說明",
    });
    expect(text).toContain("分類：日本選品");
    expect(text).toContain("名稱：測試商品");
    expect(text).toContain("價格：NT$250");
    expect(text).toContain("庫存：3 件");
    expect(text).toContain("照片：（未上傳）");
  });
});

describe("shopBotAdminIds", () => {
  it("逗號或空白都能分隔", () => {
    vi.stubEnv("TELEGRAM_ADMIN_IDS", " 123 , 456\n789 ");
    expect(shopBotAdminIds()).toEqual(["123", "456", "789"]);
  });

  it("沒設定時回空陣列，機器人不會讓任何人上架", () => {
    vi.stubEnv("TELEGRAM_ADMIN_IDS", "");
    expect(shopBotAdminIds()).toEqual([]);
  });
});
