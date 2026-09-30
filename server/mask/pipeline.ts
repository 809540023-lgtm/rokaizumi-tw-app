/**
 * 面膜自動化流程。
 *
 *   photos → vision（AI 辨識）→ pricing（成本與定價）→ copy（中文文案）→ compliance（法遵）
 *   → 人工確認 → publish（寫進 products，成為前台可買的商品）
 *
 * 每個階段都會寫一筆 maskRuns，失敗時可以清楚知道是哪一步、第幾次、為什麼。
 * 階段之間只透過 masks 這張表傳遞資料，所以任何一步都可以單獨重跑。
 */

import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import * as dbHelpers from "../db";
import { masks, maskRuns, products } from "../../drizzle/schema";
import { recognizeMaskPhotos, toAttributePayload, type VisionResult } from "./vision";
import { scanText, sanitizeText, checkLabels, type Finding } from "./compliance";
import { computeLandedCost, buildPricePlans, estimateWeightGrams, DEFAULT_COST_MODEL } from "./pricing";
import { generateCopy, templateCopy, applyCompliance, type CopyInput } from "./copy";
import { listPhotos, loadPhotoBytes } from "./photos";

/* ------------------------------------------------------------------ */
/* 型別                                                                */
/* ------------------------------------------------------------------ */

export type MaskStage = "vision" | "pricing" | "copy" | "compliance";

export interface StageLog {
  stage: MaskStage;
  status: "success" | "failed" | "skipped";
  durationMs: number;
  output?: unknown;
  error?: string;
}

export interface PipelineResult {
  maskId: string;
  status: string;
  complianceStatus: string;
  stages: StageLog[];
  summary: {
    name: string;
    brand: string | null;
    unitCostTwd: number | null;
    wholesaleTwd: number | null;
    retailTwd: number | null;
    ingredientsCount: number;
    blockedFindings: number;
    warningFindings: number;
    missingLabels: string[];
    aiGenerated: boolean;
  };
}

/* ------------------------------------------------------------------ */
/* 讀取                                                                */
/* ------------------------------------------------------------------ */

export async function getMask(maskId: string) {
  // 不用 .limit()：TiDB 不支援參數化 LIMIT；id 是主鍵本來就只會有一列
  const rows = await db.select().from(masks).where(eq(masks.id, maskId));
  return rows[0] ?? null;
}

export async function getMaskBySku(sku: string) {
  const rows = await db.select().from(masks).where(eq(masks.sku, sku));
  return rows[0] ?? null;
}

export async function listMasks(limit = 200) {
  return db.select().from(masks).orderBy(desc(masks.updatedAt)).limit(limit);
}

export async function listRecentRuns(maskId: string, limit = 50) {
  return db.select().from(maskRuns).where(eq(maskRuns.maskId, maskId)).orderBy(desc(maskRuns.id)).limit(limit);
}

/** 產生 SKU：MSK-<品牌前三碼>-<流水號> */
export async function generateSku(brand: string | null): Promise<string> {
  const abbr = (brand || "GEN")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3)
    .padEnd(3, "X");
  const counted = (await db.select({ n: sql<number>`COUNT(*)` }).from(masks)) as Array<{ n: number }>;
  const seq = Number(counted[0]?.n ?? 0) + 1;
  return `MSK-${abbr}-${String(seq).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ */
/* 匯率                                                                */
/* ------------------------------------------------------------------ */

let fxCache: { rate: number; source: string; at: number } | null = null;

export async function getJpyToTwd(): Promise<{ rate: number; source: string }> {
  const TTL_MS = 6 * 60 * 60 * 1000;
  if (fxCache && Date.now() - fxCache.at < TTL_MS) {
    return { rate: fxCache.rate, source: `${fxCache.source}(快取)` };
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/JPY", {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number> };
      const rate = data?.rates?.TWD;
      if (rate && rate > 0) {
        fxCache = { rate, source: "open.er-api.com", at: Date.now() };
        return { rate, source: "open.er-api.com" };
      }
    }
  } catch {
    // 連不上就退回設定檔的備援匯率，流程不應該因為匯率 API 掛掉而中斷
  }
  const fallback = DEFAULT_COST_MODEL.fx.fallbackJpyToTwd;
  fxCache = { rate: fallback, source: "設定檔備援匯率", at: Date.now() };
  return { rate: fallback, source: "設定檔備援匯率" };
}

/* ------------------------------------------------------------------ */
/* 階段執行紀錄                                                        */
/* ------------------------------------------------------------------ */

async function logStage(
  maskId: string,
  stage: MaskStage,
  status: "success" | "failed" | "skipped",
  durationMs: number,
  payload: { input?: unknown; output?: unknown; error?: string },
): Promise<void> {
  try {
    await db.insert(maskRuns).values({
      maskId,
      stage,
      status,
      attempt: 1,
      input: payload.input === undefined ? null : payload.input,
      output: payload.output === undefined ? null : payload.output,
      error: payload.error ?? null,
      durationMs,
    });
  } catch (err) {
    console.error("[mask] 寫入執行紀錄失敗", err);
  }
}

async function runStage<T>(
  maskId: string,
  stage: MaskStage,
  fn: () => Promise<T>,
  logs: StageLog[],
): Promise<T | null> {
  const started = Date.now();
  try {
    const output = await fn();
    const durationMs = Date.now() - started;
    await logStage(maskId, stage, "success", durationMs, { output });
    logs.push({ stage, status: "success", durationMs, output });
    return output;
  } catch (err) {
    const durationMs = Date.now() - started;
    // drizzle 會把底層驅動錯誤包在 cause 裡，只取 message 會看不到真正的原因
    const cause = (err as { cause?: { message?: string; code?: string } })?.cause;
    const message = [
      err instanceof Error ? err.message : String(err),
      cause?.code ? `［${cause.code}］` : "",
      cause?.message ? cause.message : "",
    ]
      .filter(Boolean)
      .join(" ");

    await logStage(maskId, stage, "failed", durationMs, { error: message });
    logs.push({ stage, status: "failed", durationMs, error: message });
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* 主流程                                                              */
/* ------------------------------------------------------------------ */

export interface RunOptions {
  /** 重新辨識（否則是沿用已存的 attributes） */
  refreshVision?: boolean;
  /** 進貨數量，影響運費攤提 */
  qty?: number;
  /** 現場人員提示 */
  hint?: string;
}

export async function runMaskPipeline(maskId: string, options: RunOptions = {}): Promise<PipelineResult> {
  const mask = await getMask(maskId);
  if (!mask) throw new Error(`找不到面膜 ${maskId}`);

  const stages: StageLog[] = [];
  const photos = await listPhotos(maskId);
  if (photos.length === 0) {
    throw new Error("這個品項還沒有照片，請先上傳照片再執行流程。");
  }

  /* ---- 1. AI 辨識 ---- */
  const existingAttributes = (mask.attributes ?? {}) as Record<string, unknown>;
  const hasVision = Object.keys(existingAttributes).length > 0;

  let attributes = existingAttributes;
  let visionSummary: VisionResult | null = null;

  if (!hasVision || options.refreshVision) {
    const fullPhotos = await Promise.all(
      photos.map(async (p) => {
        // 需要二進位內容才能送給模型；這裡透過 photos 模組重新取一次
        const bytes = await loadPhotoBytes(p.id);
        return {
          base64: bytes ? bytes.data.toString("base64") : "",
          mediaType: p.mimeType,
          role: p.role,
        };
      }),
    );

    const usable = fullPhotos.filter((p) => p.base64.length > 0);
    if (usable.length === 0) throw new Error("照片內容讀取失敗，無法辨識。");

    const outcome = await runStage(
      maskId,
      "vision",
      async () => {
        const result = await recognizeMaskPhotos(usable, { hint: options.hint });
        if (result.error) throw new Error(result.error);
        return result;
      },
      stages,
    );

    if (!outcome) {
      // 辨識失敗：保留原有資料，但讓流程停在這一步（後續都依賴辨識結果）
      await db
        .update(masks)
        .set({ status: "draft", note: "AI 辨識失敗，請確認 MISTRAL_API_KEY 或照片品質後重跑。" })
        .where(eq(masks.id, maskId));
      return {
        maskId,
        status: "draft",
        complianceStatus: String(mask.complianceStatus ?? "pending"),
        stages,
        summary: buildSummary(mask, [], [], [], null),
      };
    }

    visionSummary = outcome.result;
    attributes = toAttributePayload(outcome.result) as unknown as Record<string, unknown>;

    await db
      .update(masks)
      .set({
        brand: outcome.result.brand ?? mask.brand,
        nameZh: outcome.result.productNameZh ?? mask.nameZh,
        nameJa: outcome.result.productNameJp ?? mask.nameJa,
        series: outcome.result.series ?? mask.series,
        barcode: outcome.result.barcode ?? mask.barcode,
        volumeMl: outcome.result.volumeMl ?? mask.volumeMl,
        sheetsPerPack: outcome.result.sheetsPerPack ?? mask.sheetsPerPack,
        piecesPerBox: outcome.result.piecesPerBox ?? mask.piecesPerBox,
        shelfLifeMonths: outcome.result.shelfLifeMonths ?? mask.shelfLifeMonths,
        regulatoryType: outcome.result.regulatoryType,
        attributes,
        ingredients: outcome.result.ingredientsRaw,
        status: "analyzed",
        note:
          outcome.result.confidence < 0.7
            ? `AI 辨識信心度偏低（${outcome.result.confidence}），建議人工複核：${outcome.result.uncertainFields.join("、") || "未標示"}`
            : null,
      })
      .where(eq(masks.id, maskId));
  } else {
    stages.push({ stage: "vision", status: "skipped", durationMs: 0, output: { reason: "沿用已存的辨識結果" } });
    await logStage(maskId, "vision", "skipped", 0, { output: { reason: "沿用已存結果" } });
  }

  // 重新讀取（上面可能更新過）
  const current = (await getMask(maskId))!;
  const attrs = (attributes ?? {}) as Record<string, unknown>;
  const ingredients = Array.isArray(current.ingredients) ? (current.ingredients as string[]) : [];

  /* ---- 2. 定價 ---- */
  const fx = await getJpyToTwd();
  const supplierJpy = current.supplierJpy ?? (attrs.priceJpyVisible as number | null) ?? null;

  const pricingOutput = await runStage(
    maskId,
    "pricing",
    async () => {
      if (!supplierJpy || supplierJpy <= 0) {
        throw new Error("沒有進貨價（日圓），無法計算成本。請先填 supplierJpy，或讓 AI 讀到包裝上的定價。");
      }
      const weightG = estimateWeightGrams({
        sheetsPerPack: current.sheetsPerPack,
        volumeMl: current.volumeMl,
      });
      const landed = computeLandedCost(
        { supplierJpy, qty: options.qty ?? 600, weightKg: weightG / 1000 },
        fx.rate,
      );
      const plans = buildPricePlans(landed.unitCostTwd);
      const website = plans.find((p) => p.channel === "website") ?? plans[0];
      const wholesale = plans.find((p) => p.channel === "wholesale") ?? plans[0];

      await db
        .update(masks)
        .set({
          unitCostTwd: String(landed.unitCostTwd),
          wholesaleTwd: wholesale?.wholesaleTwd ?? null,
          retailTwd: website?.retailTwd ?? null,
          grossMarginPct: String(website?.retailMarginPct ?? 0),
          costBreakdown: { fx, supplierJpy, weightG, qty: landed.qty, landed, plans } as unknown as Record<
            string,
            unknown
          >,
        })
        .where(eq(masks.id, maskId));

      return { landed, plans };
    },
    stages,
  );

  if (!pricingOutput) {
    return {
      maskId,
      status: "analyzed",
      complianceStatus: String(current.complianceStatus ?? "pending"),
      stages,
      summary: buildSummary(current, ingredients, [], [], pricingOutput),
    };
  }

  const afterPricing = (await getMask(maskId))!;

  /* ---- 3. 文案 ---- */
  const copyInput: CopyInput = {
    brand: afterPricing.brand,
    nameZh: afterPricing.nameZh,
    nameJa: afterPricing.nameJa,
    series: afterPricing.series,
    volumeMl: afterPricing.volumeMl,
    sheetsPerPack: afterPricing.sheetsPerPack,
    piecesPerBox: afterPricing.piecesPerBox,
    ingredients,
    keyIngredients: Array.isArray(attrs.keyIngredients) ? (attrs.keyIngredients as string[]) : [],
    benefits: Array.isArray(attrs.benefits) ? (attrs.benefits as string[]) : [],
    usageText: (attrs.usageText as string | null) ?? null,
    cautionText: (attrs.cautionText as string | null) ?? null,
    origin: (attrs.originCountry as string | null) ?? "日本",
    manufacturer: (attrs.manufacturer as string | null) ?? null,
    shelfLifeMonths: afterPricing.shelfLifeMonths,
    priceJpyVisible: (attrs.priceJpyVisible as number | null) ?? null,
    retailTwd: afterPricing.retailTwd,
    wholesaleTwd: afterPricing.wholesaleTwd,
    moq: afterPricing.moq,
    supplierName: afterPricing.supplierName,
  };

  const copyOutput = await runStage(
    maskId,
    "copy",
    async () => {
      const generated = await generateCopy(copyInput);
      await db
        .update(masks)
        .set({
          websiteCopy: generated as unknown as Record<string, unknown>,
          wholesaleCopy: {
            caption: generated.wholesaleCaption,
            wholesaleTwd: afterPricing.wholesaleTwd,
            moq: afterPricing.moq,
          },
        })
        .where(eq(masks.id, maskId));
      return generated;
    },
    stages,
  );

  /* ---- 4. 法遵檢核（涵蓋辨識結果與產出的文案） ---- */
  const complianceOutput = await runStage(
    maskId,
    "compliance",
    async () => {
      const final = copyOutput ?? applyCompliance(templateCopy(copyInput), copyInput.brand);
      const sources: Array<{ source: string; text: string }> = [
        { source: "nameZh", text: final.name },
        { source: "description", text: final.description },
        { source: "specifications", text: final.specifications },
        { source: "features", text: final.features.join("\n") },
        { source: "wholesaleCaption", text: final.wholesaleCaption },
        { source: "benefits", text: copyInput.benefits.join("、") },
        { source: "visibleText", text: (attrs.visibleText as string[] | undefined)?.join("、") ?? "" },
        { source: "usageText", text: copyInput.usageText ?? "" },
        { source: "cautionText", text: copyInput.cautionText ?? "" },
      ].filter((s) => s.text.trim().length > 0);

      const findings: Array<Finding & { source: string }> = [];
      for (const s of sources) {
        for (const f of scanText(s.text)) findings.push({ ...f, source: s.source });
      }

      const labels = checkLabels({
        nameZh: afterPricing.nameZh,
        ingredients,
        volumeMl: afterPricing.volumeMl,
        sheetsPerPack: afterPricing.sheetsPerPack,
        piecesPerBox: afterPricing.piecesPerBox,
        shelfLifeMonths: afterPricing.shelfLifeMonths,
        origin: "日本",
        registrationNo: afterPricing.registrationNo,
        purpose: final.features[0] ?? null,
        usage: copyInput.usageText ?? "清潔後敷於臉部 10-15 分鐘後取下",
        precautions: copyInput.cautionText ?? "僅供外用，使用後如有不適請停止使用",
        manufactureDate: afterPricing.manufactureDate,
        applicant: afterPricing.importerInfo,
      });

      const blocking = findings.filter((f) => f.severity === "block");
      const warnings = findings.filter((f) => f.severity === "warn");
      const needsRegistration = afterPricing.regulatoryType === "specific_purpose";
      const registrationMissing = needsRegistration && !afterPricing.registrationNo;

      // 用語違規或特定用途缺字號 → 擋；標示缺件 → 提醒（可以產草稿但不能公開賣）
      let status: "pass" | "warn" | "blocked" = "pass";
      if (blocking.length > 0 || registrationMissing) status = "blocked";
      else if (warnings.length > 0 || labels.missing.length > 0) status = "warn";

      const report = {
        status,
        blockingCount: blocking.length,
        warningCount: warnings.length,
        findings: findings.slice(0, 200),
        labels: labels.checklist,
        missingLabels: labels.missing,
        needsRegistration,
        registrationMissing,
        readyForSale: status !== "blocked" && labels.missing.length === 0,
        checkedAt: new Date().toISOString(),
        disclaimer:
          "本檢核依《化粧品衛生安全管理法》第 10 條方向整理，非法律意見；實際法遵請以 TFDA 最新公告為準。",
      };

      await db
        .update(masks)
        .set({
          complianceStatus: status,
          complianceReport: report as unknown as Record<string, unknown>,
          status: status === "blocked" ? "compliance_blocked" : "ready",
        })
        .where(eq(masks.id, maskId));

      return report;
    },
    stages,
  );

  const finalMask = (await getMask(maskId))!;

  return {
    maskId,
    status: String(finalMask.status),
    complianceStatus: String(finalMask.complianceStatus),
    stages,
    summary: buildSummary(
      finalMask,
      ingredients,
      (complianceOutput?.findings ?? []) as Array<Finding & { source: string }>,
      finalMask.complianceReport
        ? ((finalMask.complianceReport as Record<string, unknown>).missingLabels as string[]) ?? []
        : [],
      pricingOutput,
      Boolean(copyOutput?.generated),
    ),
  };
}

function buildSummary(
  mask: Record<string, unknown>,
  ingredients: string[],
  findings: Array<Finding & { source?: string }>,
  missingLabels: string[],
  pricing: { landed: { unitCostTwd: number } } | null,
  aiGenerated = false,
): PipelineResult["summary"] {
  return {
    name: String(mask.nameZh ?? ""),
    brand: (mask.brand as string | null) ?? null,
    unitCostTwd: pricing?.landed.unitCostTwd ?? (mask.unitCostTwd ? Number(mask.unitCostTwd) : null),
    wholesaleTwd: (mask.wholesaleTwd as number | null) ?? null,
    retailTwd: (mask.retailTwd as number | null) ?? null,
    ingredientsCount: ingredients.length,
    blockedFindings: findings.filter((f) => f.severity === "block").length,
    warningFindings: findings.filter((f) => f.severity === "warn").length,
    missingLabels,
    aiGenerated,
  };
}

/* ------------------------------------------------------------------ */
/* 上架                                                                */
/* ------------------------------------------------------------------ */

const MASK_CATEGORY_NAME = "日本面膜";

/** 取得（必要時建立）面膜專用分類 */
export async function ensureMaskCategory(): Promise<number> {
  const all = (await dbHelpers.getAllCategories()) as Array<{ id: number; name: string }>;
  const found = all.find((c) => c.name === MASK_CATEGORY_NAME);
  if (found) return found.id;

  await dbHelpers.createCategory({
    name: MASK_CATEGORY_NAME,
    description: "日本進口面膜（大阪直送）",
  } as never);

  const again = (await dbHelpers.getAllCategories()) as Array<{ id: number; name: string }>;
  const created = again.find((c) => c.name === MASK_CATEGORY_NAME);
  if (!created) throw new Error("無法建立「日本面膜」分類");
  return created.id;
}

export interface PublishResult {
  productId: number;
  categoryId: number;
  imageUrl: string | null;
  photoCount: number;
}

/**
 * 把面膜上架成前台可購買的商品。
 *
 * 會擋下兩種情況：
 *   1. 法遵 blocked（有違規用語或特定用途缺字號）
 *   2. 還沒有零售價
 */
export async function publishMaskToShop(maskId: string): Promise<PublishResult> {
  const mask = await getMask(maskId);
  if (!mask) throw new Error(`找不到面膜 ${maskId}`);

  if (mask.complianceStatus === "blocked") {
    throw new Error("法遵檢核未通過（有違規用語或缺少查驗登記字號），已阻止上架。");
  }
  if (!mask.retailTwd || mask.retailTwd <= 0) {
    throw new Error("還沒有零售價，請先執行流程計算定價。");
  }

  const copy = (mask.websiteCopy ?? null) as
    | { name?: string; description?: string; specifications?: string; features?: string[] }
    | null;

  const photos = await listPhotos(maskId);
  const ordered = ["front", "box", "texture", "detail", "back"]
    .flatMap((role) => photos.filter((p) => p.role === role))
    .concat(photos.filter((p) => !["front", "box", "texture", "detail", "back"].includes(p.role)));
  const urls = ordered.map((p) => p.url);
  const imageUrl = urls[0] ?? null;

  const categoryId = await ensureMaskCategory();

  const payload = {
    name: copy?.name || mask.nameZh,
    nameJa: mask.nameJa ?? null,
    jan: mask.barcode ?? null,
    origin: "日本",
    priceJpy: mask.supplierJpy ?? null,
    costJPY: mask.supplierJpy ? String(mask.supplierJpy) : "0",
    description: copy?.description ?? null,
    specifications: copy?.specifications ?? null,
    price: mask.retailTwd,
    categoryId,
    imageUrl,
    images: urls.slice(1),
    stock: mask.stock ?? 30,
    status: "available" as const,
    lowStockThreshold: 5,
  };

  let productId = mask.productId ?? null;

  if (productId) {
    await dbHelpers.updateProduct(productId, payload as never);
  } else {
    const inserted = (await dbHelpers.createProduct(payload as never)) as unknown as Array<{ insertId?: number }>;
    productId = Number(inserted?.[0]?.insertId ?? 0) || null;

    if (!productId) {
      // 取不到 insertId 時，直接撈最新一筆同名的商品回來（不用模糊搜尋，避免抓到別的品項）
      const rows = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.name, payload.name))
        .orderBy(desc(products.id));
      productId = rows[0]?.id ?? null;
    }
  }

  await db
    .update(masks)
    .set({ status: "published", productId, note: null })
    .where(eq(masks.id, maskId));

  return { productId: productId ?? 0, categoryId, imageUrl, photoCount: urls.length };
}

/** 下架（把 products 標成 sold 並保留資料，不刪除） */
export async function unpublishMask(maskId: string): Promise<void> {
  const mask = await getMask(maskId);
  if (!mask) throw new Error(`找不到面膜 ${maskId}`);
  if (mask.productId) {
    await dbHelpers.updateProduct(mask.productId, { status: "sold" } as never);
  }
  await db
    .update(masks)
    .set({ status: "ready" })
    .where(eq(masks.id, maskId));
}

