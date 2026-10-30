import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { hashPassword } from "./_core/password";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createSessionToken: vi.fn(),
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

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: mocks.auth,
    createSessionToken: mocks.createSessionToken,
  },
}));

vi.mock("mysql2/promise", () => ({
  default: {
    createPool: () => {
      let connections = 0;
      return {
        query: mocks.query,
        execute: mocks.execute,
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

const storeRow = (overrides: Record<string, any> = {}) => ({
  id: "ST-1",
  owner_user_id: 7,
  name: "六花商店",
  contact_name: "王小明",
  phone: "0912345678",
  email: "shop@example.com",
  line_id: "",
  address: "",
  tax_id: "",
  status: "active",
  created_at: "2026-10-30 10:00:00",
  updated_at: "2026-10-30 10:00:00",
  ...overrides,
});

type Handler = (sql: string, params?: any[]) => Promise<any>;

async function call(
  path: string,
  {
    method = "GET",
    body,
    user = { id: 7, name: "店長", email: "owner@example.com", role: "user" },
    execute,
    query,
  }: {
    method?: string;
    body?: any;
    user?: any;
    execute?: Handler;
    query?: Handler;
  } = {}
) {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "mysql://localhost/shop");
  mocks.query.mockImplementation(async (sql: string, params?: any[]) =>
    String(sql).includes("GET_LOCK")
      ? [[{ acquired: 1 }]]
      : query
        ? await query(sql, params)
        : [[]]
  );
  mocks.execute.mockImplementation(execute || (async () => [[]]));
  mocks.createSessionToken.mockResolvedValue("session-token");
  if (user) mocks.auth.mockResolvedValue(user);
  else mocks.auth.mockRejectedValue(new Error("no session"));
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
        origin: "https://rokaizumi-tw.jp",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  );
}

describe("商店後台登入", () => {
  it("未登入時回報沒有使用者", async () => {
    const response = await call("/auth/me", { user: null });
    expect(await response.json()).toEqual({ user: null, store: null });
  });

  it("註冊需要有效 Email 與至少 8 碼密碼", async () => {
    const response = await call("/auth/register", {
      method: "POST",
      user: null,
      body: { email: "not-an-email", password: "12345678" },
    });
    expect(response.status).toBe(400);
  });

  it("登入成功會簽發 session cookie 並帶回商店", async () => {
    const passwordHash = hashPassword("password123");
    const response = await call("/auth/login", {
      method: "POST",
      user: null,
      body: { email: "owner@example.com", password: "password123" },
      execute: async (sql: string) => {
        const text = String(sql);
        if (text.includes("FROM users WHERE email=?"))
          return [
            [
              {
                id: 7,
                openId: "local:abc",
                name: "店長",
                email: "owner@example.com",
                role: "user",
                passwordHash,
              },
            ],
          ];
        if (text.includes("FROM line_shop_stores WHERE owner_user_id"))
          return [[storeRow()]];
        return [[]];
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("app_session_id");
    expect(await response.json()).toMatchObject({
      user: { email: "owner@example.com" },
      store: { name: "六花商店" },
    });
  });

  it("密碼錯誤不簽發 cookie", async () => {
    const response = await call("/auth/login", {
      method: "POST",
      user: null,
      body: { email: "owner@example.com", password: "wrong-password" },
      execute: async (sql: string) =>
        String(sql).includes("FROM users WHERE email=?")
          ? [
              [
                {
                  id: 7,
                  openId: "local:abc",
                  name: "店長",
                  email: "owner@example.com",
                  role: "user",
                  passwordHash: hashPassword("password123"),
                },
              ],
            ]
          : [[]],
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

describe("商店登錄", () => {
  it("未登入不能登錄商店", async () => {
    const response = await call("/store", {
      method: "POST",
      user: null,
      body: {},
    });
    expect(response.status).toBe(401);
  });

  it("必填欄位不完整時回 400", async () => {
    const response = await call("/store", {
      method: "POST",
      body: { name: "", contactName: "王小明" },
    });
    expect(response.status).toBe(400);
  });

  it("管理員首次登錄商店會立即啟用並接收既有未歸屬訂單", async () => {
    const response = await call("/store", {
      method: "POST",
      user: { id: 1, name: "管理員", email: "boss@example.com", role: "admin" },
      body: {
        name: "六花商店",
        contactName: "王小明",
        phone: "0912345678",
        email: "shop@example.com",
      },
      query: async (sql: string) =>
        String(sql).includes("COUNT(*) AS n FROM line_shop_stores")
          ? [[{ n: 0 }]]
          : [[]],
      execute: async (sql: string, params: any[] = []) => {
        const text = String(sql);
        if (text.includes("SELECT * FROM line_shop_stores WHERE owner_user_id"))
          return [[]];
        if (text.startsWith("INSERT INTO line_shop_stores"))
          return [{ affectedRows: 1 }];
        if (text.startsWith("SELECT * FROM line_shop_stores WHERE id"))
          return [[storeRow({ id: params[0] })]];
        return [[]];
      },
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      store: { name: "六花商店" },
    });
    expect(
      mocks.execute.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE line_shop_orders SET store_id=?")
      )
    ).toBe(true);
  });

  it("一般帳號登錄的商店需等待審核，且不會接手訂單", async () => {
    const response = await call("/store", {
      method: "POST",
      body: {
        name: "六花商店",
        contactName: "王小明",
        phone: "0912345678",
        email: "shop@example.com",
      },
      query: async (sql: string) =>
        String(sql).includes("COUNT(*) AS n FROM line_shop_stores")
          ? [[{ n: 0 }]]
          : [[]],
      execute: async (sql: string, params: any[] = []) => {
        const text = String(sql);
        if (text.includes("SELECT * FROM line_shop_stores WHERE owner_user_id"))
          return [[]];
        if (text.startsWith("INSERT INTO line_shop_stores"))
          return [{ affectedRows: 1 }];
        if (text.startsWith("SELECT * FROM line_shop_stores WHERE id"))
          return [[storeRow({ id: params[0], status: "pending" })]];
        return [[]];
      },
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      store: { name: "六花商店", status: "pending" },
    });
    expect(
      mocks.execute.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE line_shop_orders SET store_id=?")
      )
    ).toBe(false);
  });

  it("同一帳號不能重複登錄商店", async () => {
    const response = await call("/store", {
      method: "POST",
      body: {
        name: "六花商店",
        contactName: "王小明",
        phone: "0912345678",
        email: "shop@example.com",
      },
      execute: async (sql: string) =>
        String(sql).includes("FROM line_shop_stores WHERE owner_user_id")
          ? [[storeRow()]]
          : [[]],
    });
    expect(response.status).toBe(409);
  });

  it("統一編號格式錯誤時回 400", async () => {
    const response = await call("/store", {
      method: "POST",
      body: {
        name: "六花商店",
        contactName: "王小明",
        phone: "0912345678",
        email: "shop@example.com",
        taxId: "123",
      },
    });
    expect(response.status).toBe(400);
  });
});

describe("商店後台權限", () => {
  it("商店只能查自己的訂單", async () => {
    const response = await call("/store/orders", {
      execute: async (sql: string) =>
        String(sql).includes("FROM line_shop_stores WHERE owner_user_id")
          ? [[storeRow()]]
          : [[]],
    });
    expect(response.status).toBe(200);
    expect(
      mocks.query.mock.calls.some(
        ([sql, params]) =>
          String(sql).includes("WHERE o.store_id=?") &&
          Array.isArray(params) &&
          params[0] === "ST-1"
      )
    ).toBe(true);
  });

  it("未登錄商店不能看商店訂單", async () => {
    const response = await call("/store/orders");
    expect(response.status).toBe(403);
  });

  it("非管理員不能列出所有商店", async () => {
    const response = await call("/admin/stores");
    expect(response.status).toBe(401);
  });

  it("待審核的商店不能查看訂單", async () => {
    const response = await call("/store/orders", {
      execute: async (sql: string) =>
        String(sql).includes("FROM line_shop_stores WHERE owner_user_id")
          ? [[storeRow({ status: "pending" })]]
          : [[]],
    });
    expect(response.status).toBe(403);
  });

  it("非管理員不能核准商店", async () => {
    const response = await call("/admin/stores/ST-1/status", {
      method: "POST",
      body: { status: "active" },
    });
    expect(response.status).toBe(401);
  });

  it("管理員核准第一間商店時接手未歸屬訂單", async () => {
    const response = await call("/admin/stores/ST-1/status", {
      method: "POST",
      user: { id: 1, name: "管理員", email: "boss@example.com", role: "admin" },
      body: { status: "active" },
      query: async (sql: string) =>
        String(sql).includes("FROM line_shop_stores WHERE status='active'")
          ? [[{ n: 0 }]]
          : [[]],
      execute: async (sql: string) => {
        const text = String(sql);
        if (text.startsWith("SELECT * FROM line_shop_stores WHERE id"))
          return [[storeRow({ status: "pending" })]];
        return [[]];
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ store: { status: "active" } });
    expect(
      mocks.execute.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE line_shop_orders SET store_id=?")
      )
    ).toBe(true);
  });

  it("不能更新別間商店的訂單", async () => {
    const response = await call("/store/orders/RZ-other/fulfillment", {
      method: "POST",
      body: { status: "preparing", trackingNumber: "" },
      execute: async (sql: string) => {
        const text = String(sql);
        if (text.includes("FROM line_shop_stores WHERE owner_user_id"))
          return [[storeRow()]];
        if (text.startsWith("SELECT * FROM line_shop_orders"))
          return [[{ id: "RZ-other", status: "paid", store_id: "ST-OTHER" }]];
        return [[]];
      },
    });
    expect(response.status).toBe(404);
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
