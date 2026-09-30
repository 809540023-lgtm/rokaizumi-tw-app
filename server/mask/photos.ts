/**
 * 面膜照片的儲存與提供。
 *
 * 決策：圖片存在資料庫（LONGBLOB），並用一個公開路由 /api/mask-photo/:id 提供。
 *
 * 為什麼不放在檔案系統或 S3？
 *   - Render 的容器沒有永久磁碟，重新部署檔案就沒了
 *   - 這個專案目前沒有設定 S3 金鑰（storagePut 會直接丟錯）
 *   - 面膜商品數量不大（數十到數百張），存進 TiDB 完全可行
 *
 * 之後如果要用 S3 / CDN，只要改 photoPublicUrl() 與 savePhoto() 兩個地方，
 * 其他程式碼都不用動。
 */

import type { Express } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { maskPhotos } from "../../drizzle/schema";

/** 對外網址的來源；可用 SITE_ORIGIN 覆寫（例如測試站） */
const SITE_ORIGIN = (process.env.SITE_ORIGIN ?? "https://rokaizumi-tw.jp").replace(/\/+$/, "");

/** 圖片對外網址。商品表的 imageUrl 會存這個值。 */
export function photoPublicUrl(photoId: number): string {
  return `${SITE_ORIGIN}/api/mask-photo/${photoId}`;
}

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export function normalizeMimeType(input: string | undefined | null): string {
  const mime = String(input ?? "image/jpeg")
    .toLowerCase()
    .split(";")[0]
    .trim();
  return ALLOWED_MIME.has(mime) ? mime : "image/jpeg";
}

export interface SavePhotoInput {
  maskId: string;
  buffer: Buffer;
  mimeType?: string;
  role?: "front" | "back" | "box" | "texture" | "detail";
  sourceFile?: string | null;
  width?: number | null;
  height?: number | null;
}

/** 寫入一張照片，回傳 id 與對外網址 */
export async function savePhoto(input: SavePhotoInput): Promise<{ id: number; url: string; byteSize: number }> {
  if (!input.buffer || input.buffer.length === 0) {
    throw new Error("照片內容是空的");
  }
  const mimeType = normalizeMimeType(input.mimeType);

  const inserted = await db.insert(maskPhotos).values({
    maskId: input.maskId,
    role: input.role ?? "front",
    mimeType,
    data: input.buffer,
    byteSize: input.buffer.length,
    width: input.width ?? null,
    height: input.height ?? null,
    sourceFile: input.sourceFile ?? null,
  });

  // drizzle + mysql2 的 insert 回傳 insertId
  const insertId = Number((inserted as unknown as Array<{ insertId?: number }>)[0]?.insertId ?? 0);
  if (!insertId) {
    // 取不到 id 時退回用 maskId + 檔名查一次，避免整個上傳失敗
    const rows = await db
      .select({ id: maskPhotos.id })
      .from(maskPhotos)
      .where(eq(maskPhotos.maskId, input.maskId))
      .orderBy(maskPhotos.id);
    const last = rows[rows.length - 1];
    if (!last) throw new Error("照片寫入後找不到紀錄");
    return { id: last.id, url: photoPublicUrl(last.id), byteSize: input.buffer.length };
  }

  return { id: insertId, url: photoPublicUrl(insertId), byteSize: input.buffer.length };
}

export interface PhotoMeta {
  id: number;
  maskId: string;
  role: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  sourceFile: string | null;
  url: string;
  createdAt: Date | string;
}

/** 列出某個面膜的照片（不含二進位內容，避免把 blob 拉進記憶體） */
export async function listPhotos(maskId: string): Promise<PhotoMeta[]> {
  const rows = await db
    .select({
      id: maskPhotos.id,
      maskId: maskPhotos.maskId,
      role: maskPhotos.role,
      mimeType: maskPhotos.mimeType,
      byteSize: maskPhotos.byteSize,
      width: maskPhotos.width,
      height: maskPhotos.height,
      sourceFile: maskPhotos.sourceFile,
      createdAt: maskPhotos.createdAt,
    })
    .from(maskPhotos)
    .where(eq(maskPhotos.maskId, maskId))
    .orderBy(maskPhotos.id);

  return (rows as PhotoMeta[]).map((r) => ({ ...r, url: photoPublicUrl(r.id) }));
}

/** 判斷這張來源檔名是否已經上傳過（本機代理重跑時用，避免重複上傳同一張） */
export async function hasSourceFile(maskId: string, sourceFile: string): Promise<boolean> {
  const hit = await db
    .select({ id: maskPhotos.id })
    .from(maskPhotos)
    .where(and(eq(maskPhotos.maskId, maskId), eq(maskPhotos.sourceFile, sourceFile)));
  return hit.length > 0;
}

export async function deletePhotosForMask(maskId: string): Promise<number> {
  const result = (await db.delete(maskPhotos).where(eq(maskPhotos.maskId, maskId))) as unknown as Array<{
    affectedRows?: number;
  }>;
  return Number(result?.[0]?.affectedRows ?? 0);
}

export async function loadPhotoBytes(
  id: number,
): Promise<{ mimeType: string; data: Buffer; byteSize: number } | null> {
  // 注意：這裡刻意不用 .limit(1)。
  // TiDB 對「參數化的 LIMIT」會回 ER_WRONG_ARGUMENTS（Incorrect arguments to LIMIT），
  // 而 id 是主鍵，本來就只會有一列，不需要 LIMIT。
  const query = () =>
    db
      .select({ mimeType: maskPhotos.mimeType, data: maskPhotos.data, byteSize: maskPhotos.byteSize })
      .from(maskPhotos)
      .where(eq(maskPhotos.id, id));

  let rows: Array<{ mimeType: string; data: unknown; byteSize: number }>;
  try {
    rows = (await query()) as typeof rows;
  } catch (err) {
    // 讀 blob 偶爾會遇到連線層的暫時性錯誤（TiDB serverless），重試一次再放棄
    console.warn(`[mask-photo] 讀取照片 ${id} 失敗，重試一次：`, err instanceof Error ? err.message : err);
    await new Promise((r) => setTimeout(r, 300));
    rows = (await query()) as typeof rows;
  }

  const row = rows[0];
  if (!row) return null;
  return { mimeType: row.mimeType, data: row.data as Buffer, byteSize: row.byteSize };
}

/**
 * 註冊圖片提供路由。
 *
 * 一定要在 serveStatic / setupVite 之前呼叫，否則會被 SPA fallback 攔走，
 * 回傳 HTML 給 <img>，變成「圖片全部破損」。
 */
export function registerMaskPhotoRoute(app: Express): void {
  app.get("/api/mask-photo/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "圖片 id 格式錯誤" });
      return;
    }

    try {
      const photo = await loadPhotoBytes(id);
      if (!photo) {
        res.status(404).json({ error: "找不到圖片" });
        return;
      }

      // 圖片上傳後不會再變，可以長期快取；用 id + 大小當 ETag
      const etag = `"mp-${id}-${photo.byteSize}"`;
      if (req.headers["if-none-match"] === etag) {
        res.status(304).end();
        return;
      }

      res.setHeader("content-type", photo.mimeType);
      res.setHeader("content-length", String(photo.byteSize));
      res.setHeader("cache-control", "public, max-age=31536000, immutable");
      res.setHeader("etag", etag);
      res.end(photo.data);
    } catch (err) {
      console.error("[mask-photo] 讀取失敗", err);
      res.status(500).json({ error: "讀取圖片失敗" });
    }
  });
}
