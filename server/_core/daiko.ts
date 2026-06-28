import type { Express, Request, Response } from "express";

/**
 * 代購（貼網址）後端：抓取單一商品網址的標題、圖片、價格。
 * 僅在使用者主動貼上某個商品網址時，抓取「那一個」商品的公開資訊用於報價，
 * 不爬取任何網站的整體目錄。
 */

function pick(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function decodeEntities(s: string | null): string | null {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

async function readJsonBody(req: Request): Promise<any> {
  if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    return req.body;
  }
  return await new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

export function registerDaikoRoutes(app: Express) {
  app.post("/api/daiko/fetch", async (req: Request, res: Response) => {
    try {
      const body = await readJsonBody(req);
      const url = String(body.url || "").trim();
      if (!/^https?:\/\//i.test(url)) {
        res.status(400).json({ ok: false, error: "請輸入有效的商品網址（http/https）" });
        return;
      }

      let html = "";
      try {
        const resp = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Accept-Language": "ja,zh-TW;q=0.8,en;q=0.6",
            Accept: "text/html,application/xhtml+xml",
          },
          redirect: "follow",
        });
        html = await resp.text();
      } catch (e) {
        res.json({ ok: false, error: "無法連線到此網址，請確認網址或改為手動填寫。" });
        return;
      }

      const title = decodeEntities(
        pick(html, [
          /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
          /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
          /<title[^>]*>([^<]+)<\/title>/i,
        ])
      );

      const image = decodeEntities(
        pick(html, [
          /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
          /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        ])
      );

      const priceRaw = pick(html, [
        /<meta[^>]+property=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([0-9.,]+)["']/i,
        /<meta[^>]+itemprop=["']price["'][^>]+content=["']([0-9.,]+)["']/i,
        /"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i,
        /"priceAmount"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)"?/i,
        /[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,7})/,
        /([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{3,7})\s*円/,
      ]);

      let priceJPY: number | null = priceRaw ? Number(priceRaw.replace(/,/g, "")) : null;
      if (priceJPY !== null && (!isFinite(priceJPY) || priceJPY <= 0)) priceJPY = null;

      res.json({
        ok: true,
        title: title || null,
        image: image || null,
        priceJPY,
        sourceUrl: url,
      });
    } catch (error) {
      console.error("[daiko] fetch error", error);
      res.json({ ok: false, error: "取得商品資訊時發生錯誤，請改為手動填寫。" });
    }
  });
}
