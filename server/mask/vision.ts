/**
 * AI 看圖辨識面膜。
 *
 * 沿用專案裡已經在用的 Mistral 視覺模型（Pixtral）與 MISTRAL_API_KEY，
 * 不引入新的供應商與金鑰。做法與 server/_core/ai.ts 的「AI 選品助理」一致，
 * 但這裡要求的是「面膜上架需要的一整組結構化欄位」，而不是一段商品說明。
 *
 * 兩個刻意的設計：
 *  1. 一次把多張照片（正面、背面成分）送進同一個請求。
 *     Mistral 支援一個訊息多張圖，比分開呼叫再合併便宜也更準。
 *  2. 明確要求「看不到就填 null」。寧可欄位是空的再人工補，
 *     也不要讓模型編造成分或日圓價格，那些會直接變成上架錯誤。
 */

import type { Severity } from "./compliance";

const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

export interface VisionImage {
  base64: string;
  mediaType?: string;
  role?: string;
}

export interface VisionResult {
  brand: string | null;
  productNameJp: string | null;
  productNameZh: string | null;
  series: string | null;
  category: string;
  subCategory: string | null;
  barcode: string | null;
  volumeMl: number | null;
  sheetsPerPack: number | null;
  piecesPerBox: number | null;
  ingredientsRaw: string[];
  keyIngredients: string[];
  perceivedBenefits: string[];
  usageText: string | null;
  cautionText: string | null;
  priceJpyVisible: number | null;
  packagingType: string | null;
  originCountry: string | null;
  manufacturer: string | null;
  shelfLifeMonths: number | null;
  regulatoryType: "general" | "specific_purpose";
  visibleText: string[];
  confidence: number;
  uncertainFields: string[];
  notes: string | null;
  /** 實際使用的模型與是否為模擬結果 */
  model: string;
  mock: boolean;
}

export interface VisionOptions {
  /** 現場人員的補充說明，例如「難波店限定 / 一盒5片」 */
  hint?: string;
  /** 指定模型；預設自動輪流嘗試 */
  model?: string;
  /** 測試用：注入假的 fetch */
  fetchImpl?: typeof fetch;
}

const SYSTEM_PROMPT = [
  "你是日本化粧品進口採購專家，專長是從商品照片讀出可上架、可報關的正確資訊。",
  "規則：",
  "1. 只描述照片中確實可見的資訊。看不到的一律填 null，嚴禁猜測或編造品牌、成分、價格、認證。",
  "2. 不可以使用任何醫療效能字眼（治療、消炎、抗痘、美白等）。功效一律中性描述為「保養感受」。",
  "3. 成分表若可辨識，依原文照抄，不要翻譯、不要增刪、不要自行排序。",
  "4. 只輸出一個 JSON 物件，不要任何說明文字或 markdown。",
].join("\n");

const FIELDS_SPEC = {
  brand: "string|null 品牌（日文或英文原文）",
  productNameJp: "string|null 日文品名",
  productNameZh: "string|null 建議中文品名（不得含醫療或誇大字眼）",
  series: "string|null 系列名",
  category: "string 固定填「面膜」",
  subCategory: "string|null 例如 貼片式面膜／水洗式面膜",
  barcode: "string|null JAN/EAN 條碼數字",
  volumeMl: "number|null 單片或單包容量 mL",
  sheetsPerPack: "number|null 每包片數",
  piecesPerBox: "number|null 每盒入數",
  ingredientsRaw: "string[] 可辨識的全成分原文（依包裝順序）",
  keyIngredients: "string[] 包裝上主打／放大的成分",
  perceivedBenefits: "string[] 由包裝文字推得的中性保養訴求（禁止醫療用語）",
  usageText: "string|null 包裝上的用法原文（日文可）",
  cautionText: "string|null 包裝上的注意事項原文（日文可）",
  priceJpyVisible: "number|null 照片中可見的日圓定價（含稅）",
  packagingType: "string|null 例如 鋁袋、紙盒、軟管",
  originCountry: "string|null 例如 日本",
  manufacturer: "string|null 製造販売元",
  shelfLifeMonths: "number|null 有效期限（月）",
  regulatoryType: '"general"|"specific_purpose"：包裝若有美白／防曬／染髮等字樣則為 specific_purpose',
  visibleText: "string[] 照片中所有可讀文字（用來核對）",
  confidence: "number 0-1 對整份判讀的信心度",
  uncertainFields: "string[] 需要人工複核的欄位名稱",
  notes: "string|null 其他觀察",
};

function buildPrompt(hint?: string): string {
  return [
    "這是面膜商品的多張照片（可能包含正面、背面成分表、外盒、質地特寫）。",
    "請抽出下列欄位的 JSON：",
    JSON.stringify(FIELDS_SPEC, null, 2),
    hint ? `補充提示（現場人員提供，可信度高）：${hint}` : "",
    "confidence 請誠實反映：照片模糊、反光、成分表看不清楚就給低分，並把該欄位放進 uncertainFields。",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const asString = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "null" ? null : s;
};

const asNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const asStringArray = (v: unknown): string[] => {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter((x) => x.length > 0);
};

/** 把模型回傳的鬆散 JSON 收斂成固定形狀 */
export function normalizeVisionResult(raw: Record<string, unknown>, model: string): VisionResult {
  const regulatory = asString(raw.regulatoryType);
  return {
    brand: asString(raw.brand),
    productNameJp: asString(raw.productNameJp),
    productNameZh: asString(raw.productNameZh),
    series: asString(raw.series),
    category: asString(raw.category) ?? "面膜",
    subCategory: asString(raw.subCategory),
    barcode: asString(raw.barcode)?.replace(/[^\d]/g, "") || null,
    volumeMl: asNumber(raw.volumeMl),
    sheetsPerPack: asNumber(raw.sheetsPerPack),
    piecesPerBox: asNumber(raw.piecesPerBox),
    ingredientsRaw: asStringArray(raw.ingredientsRaw),
    keyIngredients: asStringArray(raw.keyIngredients),
    perceivedBenefits: asStringArray(raw.perceivedBenefits),
    usageText: asString(raw.usageText),
    cautionText: asString(raw.cautionText),
    priceJpyVisible: asNumber(raw.priceJpyVisible),
    packagingType: asString(raw.packagingType),
    originCountry: asString(raw.originCountry) ?? "日本",
    manufacturer: asString(raw.manufacturer),
    shelfLifeMonths: asNumber(raw.shelfLifeMonths),
    regulatoryType: regulatory === "specific_purpose" ? "specific_purpose" : "general",
    visibleText: asStringArray(raw.visibleText),
    confidence: Math.max(0, Math.min(1, asNumber(raw.confidence) ?? 0)),
    uncertainFields: asStringArray(raw.uncertainFields),
    notes: asString(raw.notes),
    model,
    mock: false,
  };
}

export interface VisionOutcome {
  result: VisionResult;
  /** 模型回報的錯誤訊息（全部模型都失敗時說明原因） */
  error?: string;
  triedModels: string[];
}

/**
 * 辨識一張或多張面膜照片。
 *
 * 會依序嘗試多個 Pixtral 模型（與 _core/ai.ts 相同的策略），
 * 某個模型額度用完或不存在時自動換下一個。
 */
export async function recognizeMaskPhotos(
  images: VisionImage[],
  options: VisionOptions = {},
): Promise<VisionOutcome> {
  const triedModels: string[] = [];
  const key = process.env.MISTRAL_API_KEY;
  if (!key) {
    return {
      result: emptyResult("(未設定 MISTRAL_API_KEY)"),
      error: "尚未設定 MISTRAL_API_KEY，無法進行照片辨識。請在 Render 環境變數新增。",
      triedModels,
    };
  }
  if (images.length === 0) {
    return { result: emptyResult("(沒有照片)"), error: "沒有可辨識的照片。", triedModels };
  }

  const models = options.model
    ? [options.model]
    : ["pixtral-large-latest", "pixtral-12b-latest", "pixtral-12b-2409"];

  const content: Array<Record<string, unknown>> = [{ type: "text", text: buildPrompt(options.hint) }];
  for (const img of images.slice(0, 4)) {
    const mediaType = img.mediaType ?? "image/jpeg";
    const pureBase64 = img.base64.replace(/^data:[^;]+;base64,/, "");
    content.push({
      type: "image_url",
      image_url: `data:${mediaType};base64,${pureBase64}`,
    });
  }

  let lastError = "";
  const doFetch = options.fetchImpl ?? fetch;

  for (const model of models) {
    triedModels.push(model);
    try {
      const res = await doFetch(MISTRAL_ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content },
          ],
          max_tokens: 2048,
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastError = `模型 ${model} 回應 ${res.status}：${body.slice(0, 200)}`;
        continue;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const rawContent = data?.choices?.[0]?.message?.content;
      const text =
        typeof rawContent === "string"
          ? rawContent
          : Array.isArray(rawContent)
            ? rawContent.map((p: { text?: string }) => p?.text ?? "").join("\n")
            : "";

      const parsed = extractJson(text);
      if (!parsed) {
        lastError = `模型 ${model} 回傳的內容無法解析成 JSON`;
        continue;
      }
      return { result: normalizeVisionResult(parsed, model), triedModels };
    } catch (err) {
      lastError = `模型 ${model} 呼叫失敗：${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return { result: emptyResult(models[0]), error: lastError || "所有模型都無法完成辨識。", triedModels };
}

function emptyResult(model: string): VisionResult {
  return {
    brand: null,
    productNameJp: null,
    productNameZh: null,
    series: null,
    category: "面膜",
    subCategory: null,
    barcode: null,
    volumeMl: null,
    sheetsPerPack: null,
    piecesPerBox: null,
    ingredientsRaw: [],
    keyIngredients: [],
    perceivedBenefits: [],
    usageText: null,
    cautionText: null,
    priceJpyVisible: null,
    packagingType: null,
    originCountry: "日本",
    manufacturer: null,
    shelfLifeMonths: null,
    regulatoryType: "general",
    visibleText: [],
    confidence: 0,
    uncertainFields: [
      "brand",
      "productNameJp",
      "barcode",
      "volumeMl",
      "sheetsPerPack",
      "ingredientsRaw",
      "priceJpyVisible",
    ],
    notes: null,
    model,
    mock: false,
  };
}

export interface MaskAttributes {
  benefits: string[];
  usageText: string | null;
  cautionText: string | null;
  visibleText: string[];
  confidence: number;
  uncertainFields: string[];
  notes: string | null;
  model: string;
  keyIngredients: string[];
  packagingType: string | null;
  manufacturer: string | null;
  originCountry: string | null;
  priceJpyVisible: number | null;
}

/** 把 VisionResult 拆成「存進 masks 表的 attributes 欄位」 */
export function toAttributePayload(v: VisionResult): MaskAttributes {
  return {
    benefits: v.perceivedBenefits,
    usageText: v.usageText,
    cautionText: v.cautionText,
    visibleText: v.visibleText,
    confidence: v.confidence,
    uncertainFields: v.uncertainFields,
    notes: v.notes,
    model: v.model,
    keyIngredients: v.keyIngredients,
    packagingType: v.packagingType,
    manufacturer: v.manufacturer,
    originCountry: v.originCountry,
    priceJpyVisible: v.priceJpyVisible,
  };
}

export type { Severity };
