import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerLocalAuthRoutes } from "./authLocal";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initTelegramBot } from "./telegramBot";
import openclawRouter from "../routers/openclaw";
import { handleStripeWebhook } from "../stripe-webhook";
import candleOrdersRouter from "../candle-orders";
import { registerAiRoutes } from "./ai";
import { maskAgentRouter } from "../mask/agentRoutes";
import { registerMaskPhotoRoute } from "../mask/photos";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
  // Stripe requires the untouched request body to verify its webhook signature.
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/api/candles/orders", candleOrdersRouter);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // 本站帳密登入。先前未註冊，導致 /api/auth/register 與 /api/auth/login
  // 落到 SPA fallback 回傳 HTML，登入註冊完全不能用。
  registerLocalAuthRoutes(app);
  // OpenClaw API
  app.use("/api/openclaw", openclawRouter);
  // 面膜作業：本機代理用的 REST API（照片同步、跑流程、查狀態）
  app.use("/api/mask-agent", maskAgentRouter);
  // 面膜照片：公開提供圖片給前台 <img src> 使用
  registerMaskPhotoRoute(app);
  // AI 選品助理（Mistral 看圖辨識）。
  // 注意：這個函式先前從未被呼叫，導致 Selection.tsx 打的
  // /api/ai/product-draft 會落到 SPA fallback 回傳 HTML，功能其實是壞的。
  registerAiRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Initialize Telegram Bot
  initTelegramBot();
}

startServer().catch(console.error);
