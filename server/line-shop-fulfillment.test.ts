import { afterEach, describe, expect, it, vi } from "vitest";
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
  // initialize() 的庫存遷移會自己開一條連線並 commit 一次；用獨立的 spy，
  // 才不會讓那次 commit 混進訂單交易的斷言。
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
        // 第一次 getConnection() 來自 initialize()，之後才是請求的交易。
        getConnection: async () =>
          ++connections === 1
            ? { query: mocks.query, execute: mocks.execute, ...mocks.migration }
            : mocks,
      };
    },
  },
}));
import router from "./line-shop";
let server: Server;
afterEach(async () => {
  if (server) await new Promise<void>(r => server.close(() => r()));
  vi.unstubAllEnvs();
});
async function update(
  body: any,
  { paid = true, current = null, admin = true, origin = true }: any = {}
) {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "mysql://localhost/shop");
  // initialize() 會用 GET_LOCK 取得庫存遷移鎖，回傳值必須是 acquired=1，
  // 否則 database() 會拋錯，路由一律回 503。
  mocks.query.mockImplementation(async (sql: string) =>
    String(sql).includes("GET_LOCK") ? [[{ acquired: 1 }]] : [[]]
  );
  mocks.auth.mockResolvedValue({ role: admin ? "admin" : "user" });
  mocks.execute.mockImplementation(async (sql: string) =>
    sql.startsWith("SELECT * FROM line_shop_orders")
      ? [[{ id: "LS-test", status: paid ? "paid" : "pending" }]]
      : sql.startsWith("SELECT * FROM line_shop_fulfillment")
        ? [[...(current ? [current] : [])]]
        : [{ affectedRows: 1 }]
  );
  const app = express();
  app.use(express.json());
  app.use("/api/line-shop", router);
  server = createServer(app);
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  return fetch(
    `http://127.0.0.1:${(server.address() as any).port}/api/line-shop/admin/orders/LS-test/fulfillment`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: origin ? "https://rokaizumi-tw.jp" : "https://evil.test",
      },
      body: JSON.stringify(body),
    }
  );
}
describe("paid order fulfillment", () => {
  it("requires administrator access", async () => {
    expect(
      (await update({ status: "preparing" }, { admin: false })).status
    ).toBe(401);
    expect(mocks.beginTransaction).not.toHaveBeenCalled();
  });
  it("rejects cross-origin writes", async () => {
    expect(
      (await update({ status: "preparing" }, { origin: false })).status
    ).toBe(403);
  });
  it("blocks unpaid orders", async () => {
    expect(
      (await update({ status: "preparing" }, { paid: false })).status
    ).toBe(409);
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("records preparation without changing payment state", async () => {
    const r = await update({ status: "preparing" });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ fulfillmentStatus: "preparing" });
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(
      mocks.execute.mock.calls.some(([sql]) =>
        String(sql).includes("SET status='paid'")
      )
    ).toBe(false);
  });
  it("requires preparation before shipping", async () => {
    expect((await update({ status: "shipped" })).status).toBe(409);
  });
  it("records shipment and trims tracking number", async () => {
    const r = await update(
      { status: "shipped", trackingNumber: " EG123JP " },
      { current: { status: "preparing" } }
    );
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      fulfillmentStatus: "shipped",
      trackingNumber: "EG123JP",
    });
  });
  it("prevents moving shipped orders backwards", async () => {
    expect(
      (
        await update(
          { status: "preparing" },
          { current: { status: "shipped" } }
        )
      ).status
    ).toBe(409);
  });
  it("allows tracking correction on shipped orders", async () => {
    expect(
      (
        await update(
          { status: "shipped", trackingNumber: "EG124JP" },
          { current: { status: "shipped" } }
        )
      ).status
    ).toBe(200);
  });
  it("rejects invalid status and tracking", async () => {
    expect((await update({ status: "paid", trackingNumber: "x" })).status).toBe(
      400
    );
  });
});
