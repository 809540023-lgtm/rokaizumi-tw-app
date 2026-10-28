import express from "express";
import net from "net";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerImageProxy } from "./image-proxy";

const IMAGE_URL = "https://kokubo.co.jp/wp/wp-content/uploads/KC-302_01.jpg";

let server: Server;
let port: number;

function imageResponse(body = "fake-jpeg-bytes"): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "image/jpeg", "content-length": String(body.length) },
  });
}

beforeAll(async () => {
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname === "/redirect-out") {
      const redirected = imageResponse();
      Object.defineProperty(redirected, "url", { value: "https://evil.example/x.jpg" });
      return redirected;
    }
    if (url.pathname === "/not-an-image") {
      return new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } });
    }
    return imageResponse();
  });

  const app = express();
  registerImageProxy(app, { fetchImpl: fetchImpl as unknown as typeof fetch });
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as net.AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

function get(path: string) {
  return fetch(`http://127.0.0.1:${port}${path}`);
}

describe("image proxy", () => {
  it("rejects requests without url", async () => {
    const res = await get("/api/img");
    expect(res.status).toBe(400);
  });

  it("rejects invalid urls", async () => {
    const res = await get("/api/img?url=not-a-url");
    expect(res.status).toBe(400);
  });

  it("rejects hosts outside the allowlist", async () => {
    const res = await get(`/api/img?url=${encodeURIComponent("https://evil.example/x.jpg")}`);
    expect(res.status).toBe(403);
  });

  it("rejects non-https urls", async () => {
    const res = await get(`/api/img?url=${encodeURIComponent("http://kokubo.co.jp/x.jpg")}`);
    expect(res.status).toBe(403);
  });

  it("streams allowed images with long-lived cache headers", async () => {
    const res = await get(`/api/img?url=${encodeURIComponent(IMAGE_URL)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toContain("s-maxage");
    expect(await res.text()).toBe("fake-jpeg-bytes");
  });

  it("refuses responses that are not images", async () => {
    const res = await get(`/api/img?url=${encodeURIComponent("https://kokubo.co.jp/not-an-image")}`);
    expect(res.status).toBe(415);
  });

  it("refuses redirects that leave the allowlist", async () => {
    const res = await get(`/api/img?url=${encodeURIComponent("https://kokubo.co.jp/redirect-out")}`);
    expect(res.status).toBe(502);
  });
});
