import type { Express, Request, Response } from "express";

/**
 * 商品圖片代理。
 *
 * 商品資料的 imageUrl 幾乎都是外部圖床（kokubo.co.jp、yamadakagaku.co.jp、
 * kaigo.itembox.design）的直連網址。對方一旦開防盜連，全站商品圖就會變破圖。
 * 這裡由伺服器代抓並加上長效快取標頭，Cloudflare 邊緣就會幫忙快取，
 * 前台只要打 /api/img?url=<原始網址> 即可。
 */

const DEFAULT_ALLOWED_HOSTS = [
  "kokubo.co.jp",
  "www.kokubo.co.jp",
  "www.yamadakagaku.co.jp",
  "kaigo.itembox.design",
];

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

export function allowedImageHosts(): Set<string> {
  const extra = (process.env.IMAGE_PROXY_HOSTS || "")
    .split(",")
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_HOSTS, ...extra]);
}

function isAllowed(target: URL, hosts: Set<string>): boolean {
  return target.protocol === "https:" && hosts.has(target.hostname.toLowerCase());
}

export function registerImageProxy(app: Express, deps: { fetchImpl?: typeof fetch } = {}) {
  const doFetch = deps.fetchImpl ?? fetch;
  app.get("/api/img", async (req: Request, res: Response) => {
    const raw = typeof req.query.url === "string" ? req.query.url : "";
    if (!raw) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    let target: URL;
    try {
      target = new URL(raw);
    } catch {
      res.status(400).json({ error: "invalid url" });
      return;
    }

    const hosts = allowedImageHosts();
    if (!isAllowed(target, hosts)) {
      res.status(403).json({ error: "host not allowed" });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const upstream = await doFetch(target, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; rokaizumi-image-proxy/1.0)",
          accept: "image/*",
        },
      });

      // 轉址後可能跑到不在白名單的網域，這種一律拒絕（避免 SSRF）。
      if (upstream.url) {
        let finalUrl: URL | null = null;
        try {
          finalUrl = new URL(upstream.url);
        } catch {
          finalUrl = null;
        }
        if (!finalUrl || !isAllowed(finalUrl, hosts)) {
          res.status(502).json({ error: "redirected to disallowed host" });
          return;
        }
      }
      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: `upstream ${upstream.status}` });
        return;
      }

      const contentType = upstream.headers.get("content-type") || "";
      if (!contentType.toLowerCase().startsWith("image/")) {
        res.status(415).json({ error: "not an image" });
        return;
      }

      const declaredLength = Number(upstream.headers.get("content-length") || 0);
      if (declaredLength > MAX_BYTES) {
        res.status(413).json({ error: "image too large" });
        return;
      }

      res.status(200);
      res.setHeader("content-type", contentType);
      res.setHeader("cache-control", "public, max-age=604800, s-maxage=2592000, immutable");
      res.setHeader("x-content-type-options", "nosniff");

      const reader = upstream.body.getReader();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel().catch(() => {});
          res.destroy();
          return;
        }
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (error) {
      if (!res.headersSent) {
        const aborted = error instanceof Error && error.name === "AbortError";
        res.status(aborted ? 504 : 502).json({ error: aborted ? "upstream timeout" : "upstream error" });
      } else {
        res.destroy();
      }
    } finally {
      clearTimeout(timer);
    }
  });
}
