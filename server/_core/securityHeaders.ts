import type { Express, Request, Response, NextFunction } from "express";

/**
 * 全站安全標頭。這個站會處理訂單與刷卡流程，缺少 HSTS／CSP 等標頭時
 * 瀏覽器與掃描工具都會視為高風險。
 *
 * CSP 刻意保留 'unsafe-inline' 與 https: 圖片來源：站上多個靜態頁（LINE 商店、
 * 蠟燭訂單、離線頁）使用行內 script，商品圖也放在外部圖床。仍以 object-src、
 * base-uri、form-action、frame-ancestors 收緊最容易被利用的部分。
 * 若日後有頁面被 CSP 擋住，可暫時設定 SECURITY_HEADERS_CSP=off 停用 CSP，
 * 其餘標頭不受影響。
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join("; ");

export function registerSecurityHeaders(app: Express) {
  // 不要對外宣告使用 Express，減少指紋。
  app.disable("x-powered-by");

  const cspEnabled =
    (process.env.SECURITY_HEADERS_CSP || "on").toLowerCase() !== "off";

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(self)"
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    if (cspEnabled) res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    next();
  });
}

/**
 * 未知的 /api/* 先前會落到 SPA fallback，回傳 200 的 index.html。
 * 前端拿 response.json() 解析時只會得到看不懂的錯誤，也讓 404 無法被監控。
 */
export function registerApiNotFound(app: Express) {
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "找不到這個 API 路徑" });
  });
}
