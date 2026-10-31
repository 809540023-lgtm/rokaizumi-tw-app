import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  // initialize() 的庫存遷移會自己開一條連線，用獨立的 spy 才不會混進請求的交易斷言。
  migration: {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  },
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.auth } }));
vi.mock("mysql2/promise", () => ({
  default: {
    createPool: () => {
      let connections = 0;
      return {
        query: mocks.query,
        getConnection: async () =>
          ++connections === 1
            ? { query: mocks.query, execute: mocks.execute, ...mocks.migration }
            : mocks,
      };
    },
  },
}));

import router from "./line-shop";

const PRODUCT = {
  id: "M001",
  name: "毛穴撫子｜米萃保濕面膜",
  jp: "毛穴撫子 お米のマスク",
  spec: "10片",
  price: 186,
  catalog: "shop",
};
const ROW = {
  id: "M001",
  data_json: JSON.stringify(PRODUCT),
  stock: 10,
  active: 1,
};

let server: Server;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "mysql://localhost/shop");
  // initialize() 會用 GET_LOCK 取得庫存遷移鎖，acquired 必須是 1，否則一律 503。
  mocks.query.mockImplementation(async (sql: string) =>
    String(sql).includes("GET_LOCK")
      ? [[{ acquired: 1 }]]
      : String(sql).includes("FROM line_shop_products")
        ? [[{ ...ROW }]]
        : [[]]
  );
  mocks.execute.mockImplementation(async (sql: string) =>
    String(sql).includes("FOR UPDATE") ? [[{ ...ROW }]] : [{ affectedRows: 1 }]
  );
  mocks.auth.mockResolvedValue({ role: "admin" });
});

afterEach(async () => {
  if (server) await new Promise<void>(r => server.close(() => r()));
  vi.unstubAllEnvs();
});

async function call(
  path: string,
  { method = "GET", body, admin = true }: any = {}
) {
  mocks.auth.mockResolvedValue({ role: admin ? "admin" : "user" });
  const app = express();
  app.use(express.json());
  app.use("/api/line-shop", router);
  server = createServer(app);
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  return fetch(
    `http://127.0.0.1:${(server.address() as any).port}/api/line-shop${path}`,
    {
      method,
      headers: {
        "Content-Type": "application/json",
        // 非 GET 有同源檢查，缺 Origin 會被 403。
        origin: "https://rokaizumi-tw.jp",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }
  );
}

describe("LINE shop product admin", () => {
  it("requires administrator access", async () => {
    const res = await call("/admin/products", { admin: false });
    expect(res.status).toBe(401);
  });

  it("lists every product with its shelf state", async () => {
    const res = await call("/admin/products");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.products).toHaveLength(1);
    expect(data.products[0]).toMatchObject({
      id: "M001",
      name: "毛穴撫子｜米萃保濕面膜",
      price: 186,
      stock: 10,
      active: true,
    });
  });

  it("saves price and stock", async () => {
    const res = await call("/admin/products/M001", {
      method: "PATCH",
      body: { price: 250, stock: 7 },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "M001",
      price: 250,
      stock: 7,
      active: true,
      overridden: [],
    });
    const update = mocks.execute.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE line_shop_products")
    );
    expect(update).toBeTruthy();
    const [sql, params] = update!;
    expect(sql).toContain("SET data_json=?, stock=?, active=?, admin_json=?");
    expect(JSON.parse(params[0])).toMatchObject({ id: "M001", price: 250 });
    expect(params.slice(1)).toEqual([7, true, null, "M001"]);
  });

  it("takes a product off the shelf", async () => {
    const res = await call("/admin/products/M001", {
      method: "PATCH",
      body: { active: false },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).active).toBe(false);
    const update = mocks.execute.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE line_shop_products")
    );
    // 只下架時價格維持原值，不會被清掉。
    expect(JSON.parse(update![1][0])).toMatchObject({ price: 186 });
    expect(update![1][1]).toBe(10);
    expect(update![1][2]).toBe(false);
  });

  it("stores edited copy in admin_json", async () => {
    const res = await call("/admin/products/M001", {
      method: "PATCH",
      body: {
        name: "毛穴撫子｜米萃保濕面膜（改）",
        desc: "新的說明文字",
        image: "https://example.test/mask.png",
      },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      name: "毛穴撫子｜米萃保濕面膜（改）",
      desc: "新的說明文字",
      image: "https://example.test/mask.png",
      overridden: ["name", "desc", "image"],
    });
    const update = mocks.execute.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE line_shop_products")
    );
    expect(JSON.parse(update![1][3])).toEqual({
      name: "毛穴撫子｜米萃保濕面膜（改）",
      desc: "新的說明文字",
      image: "https://example.test/mask.png",
    });
    // 目錄檔那份 data_json 不該被內容編輯改寫。
    expect(JSON.parse(update![1][0])).toMatchObject({ name: PRODUCT.name });
  });

  it("clears an override when the field is emptied", async () => {
    mocks.execute.mockImplementation(async (sql: string) =>
      String(sql).includes("FOR UPDATE")
        ? [
            [
              {
                ...ROW,
                admin_json: JSON.stringify({ name: "改過的品名", desc: "改過的說明" }),
              },
            ],
          ]
        : [{ affectedRows: 1 }]
    );
    const res = await call("/admin/products/M001", {
      method: "PATCH",
      body: { desc: "  " },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).overridden).toEqual(["name"]);
    const update = mocks.execute.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE line_shop_products")
    );
    expect(JSON.parse(update![1][3])).toEqual({ name: "改過的品名" });
  });

  it("drops admin_json entirely once nothing is overridden", async () => {
    mocks.execute.mockImplementation(async (sql: string) =>
      String(sql).includes("FOR UPDATE")
        ? [[{ ...ROW, admin_json: JSON.stringify({ name: "改過的品名" }) }]]
        : [{ affectedRows: 1 }]
    );
    const res = await call("/admin/products/M001", {
      method: "PATCH",
      body: { name: "" },
    });
    expect(res.status).toBe(200);
    const update = mocks.execute.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE line_shop_products")
    );
    expect(update![1][3]).toBeNull();
  });

  it.each([
    [{ image: "javascript:alert(1)" }],
    [{ image: "http://example.test/a.png" }],
    [{ image: "//example.test/a.png" }],
    [{ name: "x".repeat(121) }],
    [{ desc: "x".repeat(1001) }],
    [{ spec: "x".repeat(61) }],
    [{ tag: "x".repeat(41) }],
    [{ jp: "x".repeat(121) }],
    [{ name: 123 }],
  ])("rejects invalid content %j", async body => {
    const res = await call("/admin/products/M001", { method: "PATCH", body });
    expect(res.status).toBe(400);
  });

  it.each([
    [{ price: 0 }],
    [{ price: -5 }],
    [{ price: 12.5 }],
    [{ price: "250" }],
    [{ price: 100001 }],
    [{ stock: -1 }],
    [{ stock: 100001 }],
    [{ active: "yes" }],
  ])("rejects invalid payload %j", async body => {
    const res = await call("/admin/products/M001", { method: "PATCH", body });
    expect(res.status).toBe(400);
    expect(mocks.execute).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE line_shop_products"),
      expect.anything()
    );
  });

  it("rejects fields it cannot edit", async () => {
    const res = await call("/admin/products/M001", {
      method: "PATCH",
      body: { weight: 100 },
    });
    expect(res.status).toBe(400);
  });

  it("rejects an empty patch", async () => {
    const res = await call("/admin/products/M001", {
      method: "PATCH",
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown product", async () => {
    mocks.execute.mockImplementation(async (sql: string) =>
      String(sql).includes("FOR UPDATE") ? [[]] : [{ affectedRows: 1 }]
    );
    const res = await call("/admin/products/NOPE", {
      method: "PATCH",
      body: { stock: 1 },
    });
    expect(res.status).toBe(404);
  });

  it("reports which fields the admin has overridden", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("FROM line_shop_products")
        ? [[{ ...ROW, admin_json: JSON.stringify({ name: "後台改的品名" }) }]]
        : [[]]
    );
    const res = await call("/admin/products");
    const data = await res.json();
    expect(data.products[0]).toMatchObject({
      name: "後台改的品名",
      overridden: ["name"],
    });
  });

  it("shows the edited copy on the storefront", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("FROM line_shop_products")
        ? [
            [
              {
                ...ROW,
                admin_json: JSON.stringify({
                  name: "後台改的品名",
                  desc: "後台改的說明",
                  image: "https://example.test/mask.png",
                }),
              },
            ],
          ]
        : [[]]
    );
    const res = await call("/products");
    expect(res.status).toBe(200);
    expect((await res.json()).products[0]).toMatchObject({
      id: "M001",
      name: "後台改的品名",
      desc: "後台改的說明",
      image: "https://example.test/mask.png",
    });
  });

  it("keeps the catalog description when nobody edited it", async () => {
    // data_json 的說明可能落後於目錄檔（INSERT IGNORE 只寫一次），所以未覆寫時
    // 仍要優先用目錄檔那份。
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("FROM line_shop_products")
        ? [[{ ...ROW, data_json: JSON.stringify({ ...PRODUCT, desc: "舊的說明" }) }]]
        : [[]]
    );
    const res = await call("/products");
    const desc = (await res.json()).products[0].desc;
    expect(desc).not.toBe("舊的說明");
    expect(desc).toContain("共10片");
  });
});

describe("LINE shop product creation", () => {
  const NEW_PRODUCT = {
    id: "COSTCO-15192",
    name: "コストコ 有機エキストラバージンオリーブオイル",
    desc: "2L 大容量",
    catalog: "costco",
    price: 899,
    stock: 5,
  };

  function insertCalls() {
    return mocks.query.mock.calls.filter(([sql]) =>
      String(sql).startsWith("INSERT INTO line_shop_products")
    );
  }

  it("creates a product with the caller supplied id", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("GET_LOCK")
        ? [[{ acquired: 1 }]]
        : String(sql).includes("SELECT id FROM line_shop_products")
          ? [[]]
          : [[]]
    );
    const res = await call("/admin/products", {
      method: "POST",
      body: NEW_PRODUCT,
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      id: "COSTCO-15192",
      name: NEW_PRODUCT.name,
      price: 899,
      stock: 5,
      active: true,
      overridden: [],
      blocked: false,
    });

    const [sql, params] = insertCalls()[0]!;
    expect(String(sql)).toContain("line_shop_products");
    const stored = JSON.parse((params as any[])[1]);
    expect(stored).toMatchObject({
      id: "COSTCO-15192",
      catalog: "costco",
      price: 899,
      desc: "2L 大容量",
      spec: "",
      jp: "",
      tag: "",
      weight: null,
    });
    expect((params as any[])[2]).toBe(5);
  });

  it("generates a TG- id when the caller omits one", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("GET_LOCK")
        ? [[{ acquired: 1 }]]
        : String(sql).includes("SELECT id FROM line_shop_products")
          ? [[]]
          : [[]]
    );
    const { id: _ignored, ...body } = NEW_PRODUCT;
    const res = await call("/admin/products", { method: "POST", body });
    expect(res.status).toBe(201);
    expect((await res.json()).id).toMatch(/^TG-/);
  });

  it("rejects an id that already exists", async () => {
    mocks.query.mockImplementation(async (sql: string) =>
      String(sql).includes("GET_LOCK")
        ? [[{ acquired: 1 }]]
        : String(sql).includes("SELECT id FROM line_shop_products")
          ? [[{ id: "COSTCO-15192" }]]
          : [[]]
    );
    const res = await call("/admin/products", {
      method: "POST",
      body: NEW_PRODUCT,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("已經存在");
    expect(insertCalls()).toHaveLength(0);
  });

  it("rejects ids with characters that break urls", async () => {
    for (const id of ["../etc/passwd", "a", "有機-1", "x".repeat(41)]) {
      const res = await call("/admin/products", {
        method: "POST",
        body: { ...NEW_PRODUCT, id },
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("商品編號");
    }
  });

  it("requires administrator access", async () => {
    const res = await call("/admin/products", {
      method: "POST",
      body: NEW_PRODUCT,
      admin: false,
    });
    expect(res.status).toBe(401);
  });

  it("rejects unknown fields and a missing catalog", async () => {
    const extra = await call("/admin/products", {
      method: "POST",
      body: { ...NEW_PRODUCT, freeShipping: true },
    });
    expect(extra.status).toBe(400);

    const { catalog: _c, ...noCatalog } = NEW_PRODUCT;
    const missing = await call("/admin/products", {
      method: "POST",
      body: noCatalog,
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toContain("分類");
  });
});
