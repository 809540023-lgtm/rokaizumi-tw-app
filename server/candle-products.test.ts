import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import net from "node:net";

const { authenticateRequest } = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest } }));

// 用記憶體表格模擬 candle_products / candle_settings，其他 SQL 回空陣列。
const { rows, settings } = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  settings: new Map<string, string>(),
}));

vi.mock("mysql2/promise", () => {
  const activeOnly = (sql: string) => /WHERE\s+active\s*=\s*1/.test(sql);
  const sortRows = (list: Record<string, unknown>[]) =>
    [...list].sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || Number(a.id) - Number(b.id));
  const pool = {
    query: async (sql: string, values?: unknown[]) => {
      if (/COALESCE\(MAX\(sort_order\)/.test(sql)) {
        const maxSort = rows.reduce((max, row) => Math.max(max, Number(row.sort_order)), 0);
        const maxId = rows.reduce((max, row) => Math.max(max, Number(row.id)), 0);
        return [[{ m: maxSort, id: maxId }]];
      }
      if (/FROM candle_products/.test(sql)) {
        return [sortRows(rows.filter(row => (activeOnly(sql) ? row.active === 1 : true)))];
      }
      if (/FROM candle_settings/.test(sql)) {
        const pairs = [...settings].map(([k, v]) => ({ k, v }));
        if (!values?.length) return [pairs];
        return [pairs.filter(pair => values.includes(pair.k))];
      }
      return [[]];
    },
    execute: async (sql: string, values: unknown[] = []) => {
      if (/^SELECT .*FROM candle_products WHERE id=\?/.test(sql)) {
        const row = rows.find(item => Number(item.id) === Number(values[0]));
        return [row ? [row] : []];
      }
      if (/INSERT IGNORE INTO candle_products/.test(sql)) {
        for (let index = 0; index + 5 < values.length; index += 6) {
          const [id, name, nameTw, sku, active, sortOrder] = values.slice(index, index + 6);
          if (!rows.some(row => Number(row.id) === Number(id)))
            rows.push({ id, name, name_tw: nameTw, sku, active, sort_order: sortOrder });
        }
        return [{}, null];
      }
      if (/INSERT INTO candle_products/.test(sql)) {
        const [id, name, nameTw, sku, active, sortOrder] = values;
        rows.push({ id, name, name_tw: nameTw, sku, active, sort_order: sortOrder });
        return [{}, null];
      }
      if (/UPDATE candle_products SET lit=/.test(sql)) {
        const row = rows.find(item => Number(item.id) === Number(values[2]));
        if (row) {
          row.lit = values[0];
          row.original = values[1];
        }
        return [{}, null];
      }
      if (/UPDATE candle_products SET name=/.test(sql)) {
        const row = rows.find(item => Number(item.id) === Number(values[5]));
        if (row) {
          row.name = values[0];
          row.name_tw = values[1];
          row.sku = values[2];
          row.active = values[3];
          row.sort_order = values[4];
        }
        return [{}, null];
      }
      if (/DELETE FROM candle_products/.test(sql)) {
        const index = rows.findIndex(row => Number(row.id) === Number(values[0]));
        if (index >= 0) rows.splice(index, 1);
        return [{ affectedRows: index >= 0 ? 1 : 0 }, null];
      }
      if (/INSERT INTO candle_settings/.test(sql)) {
        settings.set("au_price_aud", String(values[0]));
        settings.set("tw_price_twd", String(values[1]));
        return [{}, null];
      }
      if (/INSERT IGNORE INTO candle_images/.test(sql)) return [{}, null];
      return [{}, null];
    },
  };
  return { default: { createPool: () => pool }, createPool: () => pool };
});

let port = 0;
let server: ReturnType<express.Express["listen"]>;

const product = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Product ${id}`,
  name_tw: `商品 ${id}`,
  sku: `RZ-C${String(id).padStart(3, "0")}`,
  active: 1,
  sort_order: id,
  lit: null,
  original: null,
  ...overrides,
});

beforeAll(async () => {
  process.env.DATABASE_URL = "mysql://root@127.0.0.1:3306/test";
  const { default: candleProductsRouter } = await import("./candle-products");
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use("/api/candles", candleProductsRouter);
  await new Promise<void>(resolve => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  port = (server.address() as net.AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const url = (path: string) => `http://127.0.0.1:${port}/api/candles${path}`;

function signIn(role = "admin") {
  authenticateRequest.mockResolvedValue({ id: 1, role, email: "owner@example.com" });
}

function signOut() {
  authenticateRequest.mockRejectedValue(new Error("no session"));
}

describe("蠟燭商品目錄", () => {
  it("前台只回上架商品與售價", async () => {
    rows.length = 0;
    rows.push(product(1), product(2, { active: 0 }), product(3, { lit: "/api/candles/img/abc.jpg" }));
    settings.clear();
    settings.set("au_price_aud", "120");
    settings.set("tw_price_twd", "1800");
    const response = await fetch(url("/products"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.products.map((item: { id: number }) => item.id)).toEqual([1, 3]);
    expect(body.prices).toEqual({ aud: 120, twd: 1800 });
    expect(body.products[1].lit).toBe("/api/candles/img/abc.jpg");
  });

  it("沒有資料庫設定時前台回空清單與預設售價", async () => {
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const response = await fetch(url("/products"));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.products).toEqual([]);
      expect(body.prices).toEqual({ aud: 99, twd: 1499 });
    } finally {
      process.env.DATABASE_URL = saved;
    }
  });
});

describe("蠟燭商品後台", () => {
  it("未登入時拒絕存取", async () => {
    signOut();
    for (const path of ["/admin/products"]) {
      const response = await fetch(url(path));
      expect(response.status).toBe(401);
    }
    const create = await fetch(url("/admin/products"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "New" }),
    });
    expect(create.status).toBe(401);
  });

  it("非管理員角色回 403", async () => {
    signIn("user");
    const response = await fetch(url("/admin/products"));
    expect(response.status).toBe(403);
  });

  it("管理員可以新增、改名、上下架與刪除商品", async () => {
    signIn();
    rows.length = 0;
    rows.push(product(1));

    const created = await fetch(url("/admin/products"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Snow Globe", nameTw: "雪花球", sortOrder: 5 }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    expect(createdBody.product).toMatchObject({ name: "Snow Globe", nameTw: "雪花球", active: true });
    expect(createdBody.product.sku).toMatch(/^RZ-C\d{3}$/);

    const patched = await fetch(url(`/admin/products/${createdBody.product.id}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Snow Globe XL", active: false }),
    });
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ product: { name: "Snow Globe XL", active: false } });

    const removed = await fetch(url(`/admin/products/${createdBody.product.id}`), { method: "DELETE" });
    expect(removed.status).toBe(200);
    expect(rows.some(row => row.id === createdBody.product.id)).toBe(false);
  });

  it("拒絕空白品名與不存在的商品", async () => {
    signIn();
    rows.length = 0;
    const blank = await fetch(url("/admin/products"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });
    expect(blank.status).toBe(400);
    const missing = await fetch(url("/admin/products/9999"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(missing.status).toBe(404);
  });

  it("售價必須是合理範圍內的整數", async () => {
    signIn();
    const tooLow = await fetch(url("/admin/settings"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aud: 0, twd: 1499 }),
    });
    expect(tooLow.status).toBe(400);
    const ok = await fetch(url("/admin/settings"), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ aud: 105, twd: 1680 }),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).prices).toEqual({ aud: 105, twd: 1680 });
  });

  it("照片只接受 JPEG/PNG/WebP/GIF", async () => {
    signIn();
    rows.length = 0;
    rows.push(product(1));
    const rejected = await fetch(url("/admin/products/1/image"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "data:image/svg+xml;base64,PHN2Zy8+" }),
    });
    expect(rejected.status).toBe(400);

    const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000002000154a24f6c0000000049454e44ae426082", "hex");
    const accepted = await fetch(url("/admin/products/1/image"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: `data:image/png;base64,${png.toString("base64")}` }),
    });
    expect(accepted.status).toBe(200);
    const body = await accepted.json();
    expect(body.image).toMatch(/^\/api\/candles\/img\/[a-f0-9]{64}\.png$/);
    expect(rows[0].lit).toBe(body.image);
  });
});
