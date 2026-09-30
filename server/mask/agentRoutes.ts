/**
 * 本機代理專用 API。
 *
 * 為什麼不直接用 tRPC？
 *   代理是跑在你電腦上的獨立程式，用 session cookie 或 tRPC 的 superjson 協議
 *   都很彆扭。這裡提供單純的 REST：agent 打 JSON 進來、拿 JSON 出去。
 *
 * 驗證方式支援兩種，任一種通過即可：
 *   1. X-Mask-Agent-Token: <MASK_AGENT_TOKEN>   ← 本機代理用，設定一次就好
 *   2. X-Api-Key: <既有 API Key>                ← 沿用站上原本的 API Key 機制
 *
 * 掛載點：/api/mask-agent
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { masks } from "../../drizzle/schema";
import { getApiKeyByKey } from "../db";
import {
  generateSku,
  getMaskBySku,
  getMask,
  listMasks,
  runMaskPipeline,
  publishMaskToShop,
  ensureMaskCategory,
} from "./pipeline";
import { savePhoto, listPhotos, hasSourceFile, normalizeMimeType } from "./photos";

export const maskAgentRouter = Router();

/* ------------------------------------------------------------------ */
/* 驗證                                                                */
/* ------------------------------------------------------------------ */

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function maskAgentAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const expected = process.env.MASK_AGENT_TOKEN ?? "";
  const provided = String(req.headers["x-mask-agent-token"] ?? "");

  if (expected && provided && timingSafeEqual(provided, expected)) {
    next();
    return;
  }

  // 退回站上原有的 API Key 機制
  const apiKey = String(req.headers["x-api-key"] ?? req.query.api_key ?? "");
  if (apiKey) {
    try {
      const record = await getApiKeyByKey(apiKey);
      if (record && record.isActive) {
        next();
        return;
      }
    } catch {
      // 落到下面統一回 401
    }
  }

  res.status(401).json({
    error: "Unauthorized",
    message: expected
      ? "請在 X-Mask-Agent-Token 帶上正確的 token，或使用站上既有的 X-Api-Key。"
      : "伺服器沒有設定 MASK_AGENT_TOKEN，且未提供有效的 X-Api-Key。",
  });
}

/* ------------------------------------------------------------------ */
/* 健康檢查                                                            */
/* ------------------------------------------------------------------ */

maskAgentRouter.get("/ping", maskAgentAuth, async (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "mask-agent",
    aiConfigured: Boolean(process.env.MISTRAL_API_KEY),
    time: new Date().toISOString(),
  });
});

/* ------------------------------------------------------------------ */
/* 同步：把雲端抓下來的照片送進來，並可選擇直接跑完整流程                */
/* ------------------------------------------------------------------ */

interface SyncPhotoPayload {
  name?: string;
  role?: "front" | "back" | "box" | "texture" | "detail";
  base64?: string;
  dataUrl?: string;
  mimeType?: string;
}

interface SyncBody {
  /** 來源資料夾（雲端路徑），用來辨識是不是同一批 */
  folder?: string;
  /** 明確指定 SKU 時優先使用（重跑同一支商品時用） */
  sku?: string;
  brand?: string | null;
  nameZh?: string | null;
  nameJa?: string | null;
  /** 日圓進貨單價 */
  supplierJpy?: number | null;
  moq?: number | null;
  stock?: number | null;
  /** 現場提示 */
  hint?: string;
  /** 進貨數量（影響運費攤提） */
  qty?: number;
  /** 送完照片後是否直接跑流程 */
  runPipeline?: boolean;
  /** 跑完流程後是否直接上架（預設 false，建議人工確認後再上架） */
  publish?: boolean;
  photos?: SyncPhotoPayload[];
}

const ROLE_ORDER = ["front", "back", "box", "texture", "detail"] as const;

/** 由檔名猜測照片角色；猜不出來就依順序輪 */
function guessRole(fileName: string, index: number): (typeof ROLE_ORDER)[number] {
  const n = String(fileName || "").toLowerCase();
  if (/(front|omote|正面|主圖|main|外觀)/.test(n)) return "front";
  if (/(back|ura|背面|成分|ingredient|label|標示)/.test(n)) return "back";
  if (/(box|carton|外盒|盒裝|箱)/.test(n)) return "box";
  if (/(texture|swatch|質地|精華|觸感)/.test(n)) return "texture";
  if (/(detail|zoom|特寫|細節)/.test(n)) return "detail";
  return ROLE_ORDER[index % ROLE_ORDER.length];
}

/** 找出該資料夾對應的既有面膜記錄（讓重跑只補新照片，不會重複建檔） */
async function findMaskForFolder(folder: string) {
  const rows = await db.select().from(masks).where(eq(masks.sourceFolder, folder));
  return rows[0] ?? null;
}

maskAgentRouter.post("/sync", maskAgentAuth, async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as SyncBody;
    const photos = Array.isArray(body.photos) ? body.photos : [];
    const folder = String(body.folder ?? "").trim() || `agent-${new Date().toISOString().slice(0, 10)}`;

    /* 1. 決定要寫進哪一筆面膜記錄 */
    let mask = body.sku ? await getMaskBySku(body.sku) : null;
    let created = false;

    if (!mask) {
      mask = await findMaskForFolder(folder);
    }

    // 沒有指定既有品項、資料夾也對不上、又沒帶照片 → 沒東西可以建立
    if (!mask && photos.length === 0) {
      res.status(400).json({
        error: "找不到對應的品項，且這次沒有帶照片。請提供 sku、正確的 folder，或附上 photos。",
      });
      return;
    }

    if (!mask) {
      const brand = body.brand ?? null;
      const sku = body.sku ?? (await generateSku(brand));
      const id = crypto.randomUUID();

      await db.insert(masks).values({
        id,
        sku,
        brand,
        nameZh: body.nameZh ?? "（待 AI 辨識命名）",
        nameJa: body.nameJa ?? null,
        supplierJpy: body.supplierJpy ?? null,
        moq: body.moq ?? 12,
        stock: body.stock ?? 30,
        sourceFolder: folder,
        sourceFiles: photos.map((p) => p.name ?? "").filter(Boolean),
        status: "draft",
      });

      mask = await getMask(id);
      created = true;
    }

    if (!mask) {
      res.status(500).json({ error: "建立面膜記錄失敗" });
      return;
    }

    // 已有記錄時，把這次帶上來的欄位補進去（不覆蓋既有值）
    const patch: Record<string, unknown> = {};
    if (body.supplierJpy && !mask.supplierJpy) patch.supplierJpy = body.supplierJpy;
    if (body.brand && !mask.brand) patch.brand = body.brand;
    if (body.nameZh && (!mask.nameZh || mask.nameZh.includes("待 AI"))) patch.nameZh = body.nameZh;
    if (body.moq && !mask.moq) patch.moq = body.moq;
    if (typeof body.stock === "number" && body.stock > 0) patch.stock = body.stock;
    if (!mask.sourceFolder) patch.sourceFolder = folder;
    if (Object.keys(patch).length > 0) {
      await db.update(masks).set(patch as never).where(eq(masks.id, mask.id));
    }

    /* 2. 存照片（同一檔名不重複上傳） */
    let added = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i];
      const name = String(photo.name ?? `photo-${i + 1}.jpg`);

      if (await hasSourceFile(mask.id, name)) {
        skipped += 1;
        continue;
      }

      const raw = String(photo.base64 ?? photo.dataUrl ?? "");
      const pureBase64 = raw.replace(/^data:[^;]+;base64,/, "");
      if (!pureBase64) {
        failures.push(`${name}：沒有圖片資料`);
        continue;
      }

      try {
        await savePhoto({
          maskId: mask.id,
          buffer: Buffer.from(pureBase64, "base64"),
          mimeType: normalizeMimeType(photo.mimeType),
          role: photo.role ?? guessRole(name, i),
          sourceFile: name,
        });
        added += 1;
      } catch (err) {
        failures.push(`${name}：${err instanceof Error ? err.message : String(err)}`);
      }
    }

    /* 3. 依需要跑流程 */
    let pipeline: unknown = null;
    let publishResult: unknown = null;

    if (body.runPipeline !== false) {
      try {
        pipeline = await runMaskPipeline(mask.id, {
          qty: body.qty,
          hint: body.hint,
          refreshVision: added > 0,
        });
      } catch (err) {
        pipeline = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // 上架與否獨立於「有沒有跑流程」：
    // 常見情境是「先跑完流程給人檢查 → 之後只按上架」，此時 runPipeline 會是 false。
    if (body.publish) {
      try {
        publishResult = await publishMaskToShop(mask.id);
      } catch (err) {
        publishResult = { error: err instanceof Error ? err.message : String(err) };
      }
    }

    const final = (await getMask(mask.id))!;

    res.json({
      ok: true,
      created,
      maskId: final.id,
      sku: final.sku,
      status: final.status,
      complianceStatus: final.complianceStatus,
      name: final.nameZh,
      retailTwd: final.retailTwd,
      wholesaleTwd: final.wholesaleTwd,
      photos: { added, skipped, failed: failures.length, failures },
      pipeline,
      publish: publishResult,
    });
  } catch (err) {
    console.error("[mask-agent] sync 失敗", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "同步失敗" });
  }
});

/* ------------------------------------------------------------------ */
/* 查詢：讓代理可以回報目前的狀態                                        */
/* ------------------------------------------------------------------ */

maskAgentRouter.get("/status", maskAgentAuth, async (_req: Request, res: Response) => {
  try {
    const all = (await listMasks(200)) as Array<Record<string, unknown>>;
    const summary = {
      total: all.length,
      draft: all.filter((m) => m.status === "draft").length,
      ready: all.filter((m) => m.status === "ready").length,
      blocked: all.filter((m) => m.status === "compliance_blocked").length,
      published: all.filter((m) => m.status === "published").length,
    };
    res.json({
      ok: true,
      summary,
      items: all.map((m) => ({
        sku: m.sku,
        name: m.nameZh,
        status: m.status,
        complianceStatus: m.complianceStatus,
        sourceFolder: m.sourceFolder,
        retailTwd: m.retailTwd,
        productId: m.productId,
        updatedAt: m.updatedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "查詢失敗" });
  }
});

maskAgentRouter.get("/status/:sku", maskAgentAuth, async (req: Request, res: Response) => {
  try {
    const mask = await getMaskBySku(String(req.params.sku));
    if (!mask) {
      res.status(404).json({ error: "找不到這個 SKU" });
      return;
    }
    const photos = await listPhotos(mask.id);
    res.json({ ok: true, mask, photos });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "查詢失敗" });
  }
});

/* ------------------------------------------------------------------ */
/* 維護：確保分類存在（上架前先建好，避免第一次上架才失敗）               */
/* ------------------------------------------------------------------ */

maskAgentRouter.post("/ensure-category", maskAgentAuth, async (_req: Request, res: Response) => {
  try {
    const categoryId = await ensureMaskCategory();
    res.json({ ok: true, categoryId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "建立分類失敗" });
  }
});
