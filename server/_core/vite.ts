import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
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

  app.use(express.static(distPath));

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
