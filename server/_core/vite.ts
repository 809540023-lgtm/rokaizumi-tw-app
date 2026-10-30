import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";

export async function setupVite(app: Express, server: Server) {
  // vite 與 vite.config.ts 只在開發模式用到，而且都是 devDependencies。
  // 這裡刻意用動態 import：esbuild 打包時會保持 external，正式環境
  // （pnpm install --prod）才不會因為缺少 vite 而在啟動時 ERR_MODULE_NOT_FOUND。
  const { createServer: createViteServer } = await import("vite");

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    // 讓 Vite 自己載入設定檔，避免把 vite.config.ts 及其 devDependencies
    // 一起打包進 dist/index.js。
    configFile: path.resolve(import.meta.dirname, "../..", "vite.config.ts"),
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * 靜態檔的 Cache-Control。回傳 null 代表用 express.static 的預設值（max-age=0，
 * 每次都要回伺服器驗證），HTML 與商品 JSON 就是走這條。
 */
export function staticCacheControl(filePath: string): string | null {
  // 商品圖檔名固定、內容不變，可以長期快取；HTML 每次都要驗證，
  // 否則後台改完使用者還停在舊頁面。
  if (filePath.includes(`${path.sep}line-shop${path.sep}img${path.sep}`))
    return "public, max-age=604800";
  // /assets/ 底下的檔名都帶內容雜湊，內容一變檔名就變，所以可以永久快取。
  // 不設的話 express.static 預設是 max-age=0，每次開頁面都要重新驗證四支 JS，
  // Cloudflare 也不會擺進邊緣快取（cf-cache-status: DYNAMIC）。
  // sw.js 不在 /assets/ 底下，不受影響，更新才會立即生效。
  if (filePath.includes(`${path.sep}assets${path.sep}`))
    return "public, max-age=31536000, immutable";
  return null;
}

export function serveStatic(app: Express) {
  // 優先級: dist/public > server/public > client/public
  let distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.log(`dist/public not found at: ${distPath}`);
    // Fallback 1: server/public (用於 Render 部署)
    const serverPublicPath = path.resolve(import.meta.dirname, "..", "public");
    if (fs.existsSync(serverPublicPath)) {
      distPath = serverPublicPath;
      console.log(`Using server/public at: ${distPath}`);
    } else {
      console.log(`server/public not found at: ${serverPublicPath}`);
      // Fallback 2: client/public (用於開發或回退)
      distPath = path.resolve(import.meta.dirname, "../..", "client", "public");
      console.log(`Fallback to client/public at: ${distPath}`);
    }
  } else {
    console.log(`Using dist/public at: ${distPath}`);
  }

  if (!fs.existsSync(distPath)) {
    console.error(`❌ Could not find static directory: ${distPath}`);
  } else {
    console.log(`✅ Serving static files from: ${distPath}`);
    const productsPath = path.resolve(distPath, "products.json");
    if (fs.existsSync(productsPath)) {
      const count = fs.readFileSync(productsPath, "utf-8").match(/"id":/g)?.length || 0;
      console.log(`📦 Available products: ${count}`);
    } else {
      console.warn(`⚠️ products.json not found at: ${productsPath}`);
    }
  }

  app.use(
    express.static(distPath, {
      setHeaders(res, filePath) {
        const cacheControl = staticCacheControl(filePath);
        if (cacheControl) res.setHeader("Cache-Control", cacheControl);
      },
    })
  );

  // 商品圖不存在時要老實回 404，不要掉到下面回傳 index.html，
  // 不然瀏覽器會把 HTML 當成圖片。
  app.use("/line-shop/img", (_req, res) => {
    res.status(404).type("text/plain").send("Not found");
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Not Found");
    }
  });
}
