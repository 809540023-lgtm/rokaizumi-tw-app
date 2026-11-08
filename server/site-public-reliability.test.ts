import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { createServer, type Server } from "node:http";
import { documentLanguage } from "../client/src/contexts/LanguageContext";
import { isStaticAssetPath, serveStatic } from "./_core/vite";

const publicDir = resolve(import.meta.dirname, "../client/public");
const read = (name: string) => readFileSync(resolve(publicDir, name), "utf8");
let server: Server | undefined;
afterEach(async () => {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
});

describe("public metadata", () => {
  it("provides a real robots file and verified sitemap URL", () => {
    const robots = read("robots.txt");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Sitemap: https://rokaizumi-tw.jp/sitemap.xml");
    expect(robots).toContain("Disallow: /api/");
    expect(robots).not.toContain("<html");
  });
  it("indexes ready public pages without the unfinished retail entry", () => {
    const sitemap = read("sitemap.xml");
    expect(sitemap).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(sitemap).toContain("https://rokaizumi-tw.jp/products?category=care");
    expect(sitemap).toContain("https://rokaizumi-tw.jp/line-shop/");
    expect(sitemap).not.toMatch(/category=hundred|\/checkout|\/admin|<lastmod>/);
  });
  it("does not advertise nonexistent PWA screenshots", () => {
    const manifest = JSON.parse(read("manifest.json"));
    for (const entry of [...manifest.icons, ...(manifest.screenshots ?? [])]) {
      expect(existsSync(resolve(publicDir, `.${entry.src}`))).toBe(true);
    }
  });
  it.each([['zh', 'zh-TW'], ['cn', 'zh-CN'], ['ja', 'ja'], ['en', 'en']] as const)(
    "maps language %s to valid document language %s", (language, expected) => {
      expect(documentLanguage(language)).toBe(expected);
    }
  );
});

describe("static responses", () => {
  it("recognizes assets but preserves app page routes", () => {
    for (const path of ['/robots.txt', '/sitemap.xml', '/missing.js', '/images/missing.PNG']) {
      expect(isStaticAssetPath(path)).toBe(true);
    }
    for (const path of ['/', '/products', '/products/123', '/b2b']) {
      expect(isStaticAssetPath(path)).toBe(false);
    }
  });
  it("serves crawler files and gives missing assets a truthful 404", async () => {
    const app = express();
    // Vite copies this directory into dist/public in production. Source-mode
    // tests serve it explicitly before testing the shared missing-file fallback.
    app.use(express.static(publicDir));
    serveStatic(app);
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    for (const [path, mime, body] of [
      ['/robots.txt', 'text/plain', 'User-agent'],
      ['/sitemap.xml', 'application/xml', '<urlset'],
    ]) {
      const response = await fetch(base + path);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain(mime);
      expect(await response.text()).toContain(body);
    }
    const missing = await fetch(base + '/screenshots/nonexistent.png?test=1');
    expect(missing.status).toBe(404);
    expect(missing.headers.get('content-type')).toContain('text/plain');
  });
});
