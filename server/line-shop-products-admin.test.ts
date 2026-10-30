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
    expect(await res.json()).toEqual({
      id: "M001",
      price: 250,
      stock: 7,
      active: true,
    });
    const update = mocks.execute.mock.calls.find(([sql]) =>
      String(sql).startsWith("UPDATE line_shop_products")
    );
    expect(update).toBeTruthy();
    const [sql, params] = update!;
    expect(sql).toContain("SET data_json=?, stock=?, active=?");
    expect(JSON.parse(params[0])).toMatchObject({ id: "M001", price: 250 });
    expect(params.slice(1)).toEqual([7, true, "M001"]);
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
      body: { name: "改名" },
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
});
