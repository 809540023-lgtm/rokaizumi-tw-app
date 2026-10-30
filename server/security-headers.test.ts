import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import {
  registerApiNotFound,
  registerSecurityHeaders,
} from "./_core/securityHeaders";

let server: Server;

afterEach(async () => {
  if (server) await new Promise<void>(r => server.close(() => r()));
  delete process.env.SECURITY_HEADERS_CSP;
});

async function start() {
  const app = express();
  registerSecurityHeaders(app);
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  registerApiNotFound(app);
  app.use((_req, res) => {
    res.status(200).send("<html>spa</html>");
  });
  server = createServer(app);
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  return (path: string) => fetch(base + path);
}

describe("安全標頭", () => {
  it("每個回應都帶 HSTS、nosniff、X-Frame-Options 與 Referrer-Policy", async () => {
    const request = await start();
    const response = await request("/");
    expect(response.headers.get("strict-transport-security")).toContain(
      "max-age="
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("content-security-policy")).toContain(
      "object-src 'none'"
    );
    expect(response.headers.get("x-powered-by")).toBeNull();
  });

  it("可以用 SECURITY_HEADERS_CSP=off 只關掉 CSP", async () => {
    process.env.SECURITY_HEADERS_CSP = "off";
    const request = await start();
    const response = await request("/");
    expect(response.headers.get("content-security-policy")).toBeNull();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("未知 API 路徑", () => {
  it("回傳 JSON 404，不會落到 SPA fallback", async () => {
    const request = await start();
    const response = await request("/api/line-shop/not-a-route");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: "找不到這個 API 路徑" });
  });

  it("已註冊的 API 路由不受影響", async () => {
    const request = await start();
    const response = await request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("非 API 路徑仍然回傳 SPA 頁面", async () => {
    const request = await start();
    const response = await request("/line-shop/");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("spa");
  });
});
