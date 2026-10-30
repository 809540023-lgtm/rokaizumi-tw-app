import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  query: vi.fn(),
  execute: vi.fn(),
  beginTransaction: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn(),
  release: vi.fn(),
  migration: {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  },
}));

// 上傳的圖片存在這裡，讓 GET /img 能取回同一份位元組。
const images = new Map<string, { mime: string; bytes: Buffer }>();

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

const ROW = {
  id: "M001",
  data_json: JSON.stringify({ id: "M001", name: "面膜", price: 186, catalog: "shop" }),
  stock: 10,
  active: 1,
  admin_json: null,
};
// 最小的 PNG 檔頭，imageMime() 只驗檔頭。
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 7),
]);

let server: Server;

beforeEach(() => {
  vi.clearAllMocks();
  images.clear();
  vi.stubEnv("DATABASE_URL", "mysql://localhost/shop");
  mocks.query.mockImplementation(async (sql: string, params: any[]) => {
    const text = String(sql);
    if (text.includes("GET_LOCK")) return [[{ acquired: 1 }]];
    if (text.includes("FROM line_shop_images")) {
      const hit = images.get(String(params[0]));
      return [hit ? [{ mime: hit.mime, bytes: hit.bytes }] : []];
    }
    return [[]];
  });
  mocks.execute.mockImplementation(async (sql: string, params: any[]) => {
    const text = String(sql);
    if (text.includes("FROM line_shop_products")) return [[{ ...ROW }]];
    if (text.includes("FROM line_shop_images")) {
      const hit = images.get(String(params[0]));
      return [hit ? [{ mime: hit.mime, bytes: hit.bytes }] : []];
    }
    if (text.includes("INSERT IGNORE INTO line_shop_images")) {
      images.set(String(params[0]), { mime: String(params[1]), bytes: params[2] });
      return [{ affectedRows: 1 }];
    }
    return [{ affectedRows: 1 }];
  });
  mocks.auth.mockResolvedValue({ role: "admin" });
});

afterEach(async () => {
  if (server) await new Promise<void>(r => server.close(() => r()));
  vi.unstubAllEnvs();
});

async function call(path: string, { method = "GET", body, admin = true }: any = {}) {
  mocks.auth.mockResolvedValue({ role: admin ? "admin" : "user" });
  const app = express();
  app.use(express.json({ limit: "10mb" }));
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

const dataUri = (mime: string, bytes: Buffer) =>
  `data:${mime};base64,${bytes.toString("base64")}`;

describe("LINE shop product image upload", () => {
  it("requires administrator access", async () => {
    const res = await call("/admin/products/M001/image", {
      method: "POST",
      body: { data: dataUri("image/png", PNG) },
      admin: false,
    });
    expect(res.status).toBe(401);
    expect(images.size).toBe(0);
  });

  it("stores the bytes and points the product at the hashed URL", async () => {
    const res = await call("/admin/products/M001/image", {
      method: "POST",
      body: { data: dataUri("image/png", PNG) },
    });
    expect(res.status).toBe(200);
    const hash = createHash("sha256").update(PNG).digest("hex");
    expect(await res.json()).toEqual({
      id: "M001",
      image: `/api/line-shop/img/${hash}.png`,
    });
    expect(images.get(hash)?.mime).toBe("image/png");
    expect(images.get(hash)?.bytes.equals(PNG)).toBe(true);
  });

  it("serves the stored image with a permanent cache header", async () => {
    await call("/admin/products/M001/image", {
      method: "POST",
      body: { data: dataUri("image/png", PNG) },
    });
    const hash = createHash("sha256").update(PNG).digest("hex");
    const res = await call(`/img/${hash}.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("returns 404 for an unknown image id", async () => {
    const res = await call(`/img/${"a".repeat(64)}.png`);
    expect(res.status).toBe(404);
  });

  it("rejects bytes that are not actually an image", async () => {
    const res = await call("/admin/products/M001/image", {
      method: "POST",
      body: { data: dataUri("image/png", Buffer.from("<script>alert(1)</script>")) },
    });
    expect(res.status).toBe(400);
    expect(images.size).toBe(0);
  });

  it("rejects images over 3MB", async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024, 1)]);
    const res = await call("/admin/products/M001/image", {
      method: "POST",
      body: { data: dataUri("image/png", big) },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("3MB");
    expect(images.size).toBe(0);
  });

  it("rejects a body without a base64 data URI", async () => {
    const res = await call("/admin/products/M001/image", {
      method: "POST",
      body: { data: "https://example.com/a.png" },
    });
    expect(res.status).toBe(400);
  });
});
