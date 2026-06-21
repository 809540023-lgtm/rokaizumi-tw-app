import type { Express, Request, Response } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "./const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as db from "../db";

/**
 * 自建 email + 密碼 登入（取代 Manus OAuth）。
 * 登入/註冊成功後簽發與 OAuth 相同格式的 session cookie，
 * 既有的 sdk.authenticateRequest 會自動驗證、認得使用者。
 */

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calc = scryptSync(password, salt, 64);
  const orig = Buffer.from(hash, "hex");
  return calc.length === orig.length && timingSafeEqual(calc, orig);
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

async function setSession(req: Request, res: Response, openId: string, name: string) {
  const sessionToken = await sdk.createSessionToken(openId, {
    name: name || "",
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

export function registerLocalAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const body = await readJsonBody(req);
      const email = (body.email || "").trim().toLowerCase();
      const password = body.password || "";
      const name = (body.name || "").trim();
      if (!email || !password) {
        res.status(400).json({ error: "請輸入 email 與密碼" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "密碼至少 6 個字" });
        return;
      }
      const existing = await db.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "此 email 已註冊，請直接登入" });
        return;
      }
      const openId = "local:" + randomBytes(12).toString("hex");
      const passwordHash = hashPassword(password);
      const user = await db.createLocalUser({ openId, email, name: name || null, passwordHash });
      await setSession(req, res, user.openId, user.name || "");
      res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      console.error("[auth] register error", error);
      res.status(500).json({ error: "註冊失敗，請稍後再試" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const body = await readJsonBody(req);
      const email = (body.email || "").trim().toLowerCase();
      const password = body.password || "";
      if (!email || !password) {
        res.status(400).json({ error: "請輸入 email 與密碼" });
        return;
      }
      const user = await db.getUserByEmail(email);
      if (!user || !verifyPassword(password, (user as any).passwordHash)) {
        res.status(401).json({ error: "email 或密碼錯誤" });
        return;
      }
      await setSession(req, res, user.openId, user.name || "");
      res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      console.error("[auth] login error", error);
      res.status(500).json({ error: "登入失敗，請稍後再試" });
    }
  });
}
