/**
 * 面膜作業的 tRPC 路由（後台 UI 用）。
 *
 * 權限：全部走 adminProcedure。
 * 理由：這個功能會直接建立「前台可購買的商品」，而本站開放一般使用者自行註冊，
 * 如果只檢查「有登入」，任何註冊帳號都能上架商品。要給某人使用，
 * 請先在 /manage 把他的角色設為管理員。
 */

import crypto from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { adminProcedure, router } from "../_core/trpc";
import { db } from "../db";
import { masks, maskPhotos, maskRuns, maskTasks, products } from "../../drizzle/schema";
import {
  generateSku,
  getMask,
  listMasks,
  listRecentRuns,
  runMaskPipeline,
  publishMaskToShop,
  unpublishMask,
  ensureMaskCategory,
  getJpyToTwd,
} from "./pipeline";
import { deletePhotosForMask, listPhotos, savePhoto, normalizeMimeType } from "./photos";
import { computeLandedCost, buildPricePlans, estimateWeightGrams, DEFAULT_COST_MODEL } from "./pricing";
import { syncMaskTasks } from "./tasks";

const photoInput = z.object({
  name: z.string().max(200).optional(),
  role: z.enum(["front", "back", "box", "texture", "detail"]).optional(),
  base64: z.string().min(1),
  mimeType: z.string().max(60).optional(),
});

const updateInput = z.object({
  id: z.string().min(1).max(40),
  brand: z.string().max(120).nullable().optional(),
  nameZh: z.string().max(255).optional(),
  nameJa: z.string().max(255).nullable().optional(),
  series: z.string().max(120).nullable().optional(),
  barcode: z.string().max(20).nullable().optional(),
  volumeMl: z.number().int().nonnegative().nullable().optional(),
  sheetsPerPack: z.number().int().nonnegative().nullable().optional(),
  piecesPerBox: z.number().int().nonnegative().nullable().optional(),
  shelfLifeMonths: z.number().int().nonnegative().nullable().optional(),
  supplierJpy: z.number().int().nonnegative().nullable().optional(),
  moq: z.number().int().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative().nullable().optional(),
  supplierName: z.string().max(120).nullable().optional(),
  regulatoryType: z.enum(["general", "specific_purpose"]).optional(),
  registrationNo: z.string().max(80).nullable().optional(),
  manufactureDate: z.string().max(60).nullable().optional(),
  importerInfo: z.string().max(255).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  /** 手動覆寫零售價（不填就用計算結果） */
  retailTwd: z.number().int().nonnegative().nullable().optional(),
  wholesaleTwd: z.number().int().nonnegative().nullable().optional(),
});

async function mustGetMask(id: string) {
  const mask = await getMask(id);
  if (!mask) throw new TRPCError({ code: "NOT_FOUND", message: "找不到這個面膜品項" });
  return mask;
}

export const mask = router({
  /* ---------------- 查詢 ---------------- */

  list: adminProcedure.query(async () => {
    const rows = (await listMasks(300)) as Array<Record<string, unknown>>;
    return rows.map((m) => ({
      id: m.id,
      sku: m.sku,
      nameZh: m.nameZh,
      nameJa: m.nameJa,
      brand: m.brand,
      status: m.status,
      complianceStatus: m.complianceStatus,
      supplierJpy: m.supplierJpy,
      unitCostTwd: m.unitCostTwd,
      wholesaleTwd: m.wholesaleTwd,
      retailTwd: m.retailTwd,
      grossMarginPct: m.grossMarginPct,
      productId: m.productId,
      sourceFolder: m.sourceFolder,
      updatedAt: m.updatedAt,
    }));
  }),

  stats: adminProcedure.query(async () => {
    const rows = (await listMasks(500)) as Array<Record<string, unknown>>;
    return {
      total: rows.length,
      draft: rows.filter((m) => m.status === "draft").length,
      ready: rows.filter((m) => m.status === "ready").length,
      blocked: rows.filter((m) => m.status === "compliance_blocked").length,
      published: rows.filter((m) => m.status === "published").length,
      needsHuman: rows.filter((m) => m.status === "draft" || m.status === "compliance_blocked").length,
    };
  }),

  get: adminProcedure.input(z.object({ id: z.string().min(1).max(40) })).query(async ({ input }) => {
    const maskRow = await mustGetMask(input.id);
    const [photos, runs] = await Promise.all([listPhotos(input.id), listRecentRuns(input.id, 40)]);
    return { mask: maskRow, photos, runs };
  }),

  runs: adminProcedure.input(z.object({ id: z.string().min(1).max(40) })).query(async ({ input }) => {
    return listRecentRuns(input.id, 60);
  }),

  /* ---------------- 建立與修改 ---------------- */

  create: adminProcedure
    .input(
      z.object({
        brand: z.string().max(120).optional(),
        nameZh: z.string().max(255).optional(),
        nameJa: z.string().max(255).optional(),
        supplierJpy: z.number().int().nonnegative().optional(),
        moq: z.number().int().nonnegative().optional(),
        stock: z.number().int().nonnegative().optional(),
        sourceFolder: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const sku = await generateSku(input.brand ?? null);
      const id = crypto.randomUUID();
      await db.insert(masks).values({
        id,
        sku,
        brand: input.brand ?? null,
        nameZh: input.nameZh ?? "（待 AI 辨識命名）",
        nameJa: input.nameJa ?? null,
        supplierJpy: input.supplierJpy ?? null,
        moq: input.moq ?? 12,
        stock: input.stock ?? 30,
        sourceFolder: input.sourceFolder ?? null,
        status: "draft",
      });
      return { id, sku };
    }),

  update: adminProcedure.input(updateInput).mutation(async ({ input }) => {
    await mustGetMask(input.id);
    const { id, ...rest } = input;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v;
    }
    if (Object.keys(patch).length === 0) return { updated: 0 };
    await db
      .update(masks)
      .set(patch as never)
      .where(eq(masks.id, id));
    return { updated: Object.keys(patch).length };
  }),

  /* ---------------- 照片 ---------------- */

  uploadPhotos: adminProcedure
    .input(z.object({ id: z.string().min(1).max(40), photos: z.array(photoInput).min(1).max(20) }))
    .mutation(async ({ input }) => {
      await mustGetMask(input.id);
      const saved: Array<{ id: number; url: string }> = [];
      const failed: string[] = [];

      for (let i = 0; i < input.photos.length; i += 1) {
        const p = input.photos[i];
        try {
          const result = await savePhoto({
            maskId: input.id,
            buffer: Buffer.from(p.base64.replace(/^data:[^;]+;base64,/, ""), "base64"),
            mimeType: normalizeMimeType(p.mimeType),
            role: p.role ?? (i === 0 ? "front" : "back"),
            sourceFile: p.name ?? null,
          });
          saved.push({ id: result.id, url: result.url });
        } catch (err) {
          failed.push(`${p.name ?? `第 ${i + 1} 張`}：${err instanceof Error ? err.message : String(err)}`);
        }
      }
      return { saved: saved.length, photos: saved, failed };
    }),

  deletePhoto: adminProcedure
    .input(z.object({ photoId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.delete(maskPhotos).where(eq(maskPhotos.id, input.photoId));
      return { ok: true };
    }),

  /* ---------------- 流程 ---------------- */

  run: adminProcedure
    .input(
      z.object({
        id: z.string().min(1).max(40),
        qty: z.number().int().positive().max(100000).optional(),
        hint: z.string().max(500).optional(),
        refreshVision: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await mustGetMask(input.id);
      try {
        return await runMaskPipeline(input.id, {
          qty: input.qty,
          hint: input.hint,
          refreshVision: input.refreshVision,
        });
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "流程執行失敗",
        });
      }
    }),

  /* ---------------- 上架 ---------------- */

  publish: adminProcedure
    .input(z.object({ id: z.string().min(1).max(40), force: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const maskRow = await mustGetMask(input.id);
      if (maskRow.complianceStatus === "blocked" && !input.force) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "法遵檢核未通過，已阻止上架。請先修正文案或補齊查驗登記字號。",
        });
      }
      try {
        return await publishMaskToShop(input.id);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "上架失敗",
        });
      }
    }),

  unpublish: adminProcedure
    .input(z.object({ id: z.string().min(1).max(40) }))
    .mutation(async ({ input }) => {
      await mustGetMask(input.id);
      await unpublishMask(input.id);
      return { ok: true };
    }),

  remove: adminProcedure
    .input(z.object({ id: z.string().min(1).max(40), removeProduct: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const maskRow = await mustGetMask(input.id);
      if (input.removeProduct && maskRow.productId) {
        await db.delete(products).where(eq(products.id, maskRow.productId));
      }
      await deletePhotosForMask(input.id);
      await db.delete(maskRuns).where(eq(maskRuns.maskId, input.id));
      await db.delete(masks).where(eq(masks.id, input.id));
      return { ok: true };
    }),

  ensureCategory: adminProcedure.mutation(async () => ({ categoryId: await ensureMaskCategory() })),

  /* ---------------- 定價試算（不寫資料庫） ---------------- */

  simulate: adminProcedure
    .input(
      z.object({
        supplierJpy: z.number().positive(),
        qty: z.number().int().positive().max(100000).optional(),
        sheetsPerPack: z.number().int().nonnegative().nullable().optional(),
        volumeMl: z.number().int().nonnegative().nullable().optional(),
      }),
    )
    .query(async ({ input }) => {
      const fx = await getJpyToTwd();
      const weightG = estimateWeightGrams({ sheetsPerPack: input.sheetsPerPack, volumeMl: input.volumeMl });
      const landed = computeLandedCost(
        { supplierJpy: input.supplierJpy, qty: input.qty ?? 600, weightKg: weightG / 1000 },
        fx.rate,
      );
      return { fx, weightG, landed, plans: buildPricePlans(landed.unitCostTwd), model: DEFAULT_COST_MODEL };
    }),

  /* ---------------- 待辦提醒 ---------------- */

  tasks: adminProcedure.query(async () => {
    const rows = await db.select().from(maskTasks).orderBy(desc(maskTasks.dueAt)).limit(100);
    return rows;
  }),

  syncTasks: adminProcedure.mutation(async () => syncMaskTasks()),

  completeTask: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db
        .update(maskTasks)
        .set({ status: "done" })
        .where(eq(maskTasks.id, input.id));
      return { ok: true };
    }),
});
