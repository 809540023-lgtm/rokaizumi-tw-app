/**
 * 產生台灣賣場用的中文文案。
 *
 * 輸出刻意配合現有商品頁的渲染方式：
 *   - description  → 前台用 <p className="leading-relaxed"> 直接顯示，所以是「純文字」
 *   - specifications → 前台用 whitespace-pre-wrap，所以用換行做條列
 * 如果產生 HTML，前台會把它當文字整串吐出來，看起來會很糟。
 *
 * 所有產出都會再過一次法遵引擎（sanitizeText），
 * 就算模型不小心寫了「美白」「消炎」也會被改掉，並留下改寫紀錄。
 */

import { sanitizeText, scanText, BLOCKING_RULES, type Finding } from "./compliance";

const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

export interface CopyInput {
  brand: string | null;
  nameZh: string | null;
  nameJa: string | null;
  series: string | null;
  volumeMl: number | null;
  sheetsPerPack: number | null;
  piecesPerBox: number | null;
  ingredients: string[];
  keyIngredients: string[];
  benefits: string[];
  usageText: string | null;
  cautionText: string | null;
  origin: string | null;
  manufacturer: string | null;
  shelfLifeMonths: number | null;
  priceJpyVisible: number | null;
  retailTwd: number | null;
  wholesaleTwd: number | null;
  moq: number | null;
  supplierName: string | null;
}

export interface CopyOutput {
  /** 前台商品名稱 */
  name: string;
  /** 純文字商品說明（前台直接顯示） */
  description: string;
  /** 條列規格（前台 whitespace-pre-wrap 顯示） */
  specifications: string;
  /** 賣點（工作台顯示 + 批發素材用） */
  features: string[];
  /** 適合誰／什麼情境 */
  targetAudience: string[];
  /** 批發群組／團媽貼文 */
  wholesaleCaption: string;
  /** 法遵自動改寫紀錄 */
  compliance: {
    status: "clean" | "auto_corrected";
    findings: Array<Finding & { source: string }>;
    replacements: Array<{ source: string; from: string; to: string }>;
  };
  /** 是否為 AI 產出（false = 用模板） */
  generated: boolean;
  model?: string;
  error?: string;
}

const SYSTEM_PROMPT = [
  "你是台灣的日系美妝選品文案寫手，專門把日本化粧品寫成台灣人看得懂、想買的商品頁文案。",
  "鐵則（違反會被開罰，務必遵守）：",
  "1. 絕對不可使用醫療效能字眼：治療、療效、消炎、殺菌、抗痘、除疤、生髮、減肥等。",
  "2. 不可宣稱「美白」「淡斑」「防曬」等特定用途功效，除非有許可字號；要改寫成「提亮膚色」「均勻膚色」。",
  "3. 不可使用誇大詞：100%、保證、最有效、唯一、一次見效、無副作用、零刺激、細胞再生、排毒。",
  "4. 不可編造成分、認證、得獎紀錄、實驗數據。資料沒有就留空。",
  "5. 只用繁體中文（台灣用語），不要中國用語。",
  "6. description 與 specifications 都是「純文字」，不要輸出 HTML 標籤。",
  "7. 只輸出一個 JSON 物件，不要 markdown 或說明。",
].join("\n");

const OUTPUT_SPEC = {
  name: "string 前台商品名稱（品牌 + 品名 + 關鍵規格，40 字內）",
  description: "string 純文字商品說明，2-4 句、約 80-150 字，具體不浮誇，不要 HTML",
  specifications: "string 用換行分隔的規格條列，例如 品牌：xxx\\n容量：xxx\\n片數：xxx\\n全成分：xxx\\n用法：xxx\\n注意事項：xxx\\n產地：xxx",
  features: ["string 3-6 條賣點，每條 12-25 字"],
  targetAudience: ["string 適合的肌膚／情境"],
  wholesaleCaption: "string 給 LINE 批發群或團媽的短貼文（含 emoji，100 字內）",
};

async function callMistral(prompt: string): Promise<{ text: string; model: string } | { error: string }> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return { error: "尚未設定 MISTRAL_API_KEY" };

  const models = process.env.AI_TEXT_MODEL
    ? [process.env.AI_TEXT_MODEL]
    : ["mistral-large-latest", "mistral-medium-latest", "pixtral-large-latest"];

  let lastError = "";
  for (const model of models) {
    try {
      const res = await fetch(MISTRAL_ENDPOINT, {
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
            { role: "user", content: prompt },
          ],
          max_tokens: 1600,
          temperature: 0.5,
          response_format: { type: "json_object" },
        }),
      });

      if (!res.ok) {
        lastError = `模型 ${model} 回應 ${res.status}：${(await res.text().catch(() => "")).slice(0, 160)}`;
        continue;
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const raw = data?.choices?.[0]?.message?.content;
      const text =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw)
            ? raw.map((p: { text?: string }) => p?.text ?? "").join("\n")
            : "";
      if (!text.trim()) {
        lastError = `模型 ${model} 回傳空內容`;
        continue;
      }
      return { text, model };
    } catch (err) {
      lastError = `模型 ${model} 呼叫失敗：${err instanceof Error ? err.message : String(err)}`;
    }
  }
  return { error: lastError || "所有模型都無法產生文案" };
}

function parseJson(text: string): Record<string, unknown> | null {
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

const str = (v: unknown, fallback = ""): string =>
  v === null || v === undefined ? fallback : String(v).trim() || fallback;

/**
 * 整理品名。
 *
 * 模型常常會把品牌在名稱裡寫兩次（「LuLuLun LuLuLun 保濕面膜」），
 * 或是同一段文字連續重複。這裡做最小幅度的清理，不改變語意。
 */
export function normalizeProductName(raw: string, brand: string | null): string {
  let name = raw.replace(/\s+/g, " ").trim();

  // 連續重複的詞（含品牌）收斂成一次
  name = name.replace(/\b(\S+)(\s+\1\b)+/gi, "$1");

  // 開頭若品牌重複出現也收斂
  if (brand) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    name = name.replace(new RegExp(`^(${escaped})(\\s+${escaped})+`, "i"), "$1");
  }

  return name.replace(/\s{2,}/g, " ").trim();
}

const strArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

/** 沒有 AI 或 AI 失敗時的保底文案（確定合規、可用） */
export function templateCopy(input: CopyInput): Omit<CopyOutput, "compliance" | "generated"> {
  const brand = input.brand ?? "日本選品";
  const spec = [
    input.sheetsPerPack ? `${input.sheetsPerPack}片/包` : null,
    input.volumeMl ? `${input.volumeMl}mL` : null,
    input.piecesPerBox ? `${input.piecesPerBox}入/盒` : null,
  ]
    .filter(Boolean)
    .join("・");

  const name = normalizeProductName(
    [brand, input.nameZh || input.nameJa || "保濕面膜", spec].filter(Boolean).join(" "),
    brand,
  ).slice(0, 60);

  const description = [
    `${brand} 出品，日本大阪門市同步販售。`,
    spec ? `規格為 ${spec}。` : "",
    "精華液質地清爽、面膜布服貼，適合作為日常保養使用。",
    "實際成分與效期請以商品包裝及中文標籤標示為準。",
  ]
    .filter(Boolean)
    .join("");

  const specLines = [
    `品牌：${brand}`,
    input.nameJa ? `日文品名：${input.nameJa}` : "",
    spec ? `規格：${spec}` : "",
    input.ingredients.length ? `全成分：${input.ingredients.slice(0, 20).join("、")}` : "",
    "用法：清潔後取出面膜敷於臉部，約 10-15 分鐘後取下，輕拍至吸收。",
    "注意事項：僅供外用。使用後如有不適請停止使用並諮詢醫師。請置於陰涼處避免陽光直射。",
    input.origin ? `產地：${input.origin}` : "產地：日本",
    input.shelfLifeMonths ? `保存期限：約 ${input.shelfLifeMonths} 個月（依包裝標示為準）` : "",
  ].filter(Boolean);

  const features = [
    spec ? `${spec}，日常保養一次到位` : "單片包裝，日常保養好攜帶",
    input.keyIngredients.length ? `含 ${input.keyIngredients.slice(0, 4).join("、")} 等成分` : "含保濕成分，敷後肌膚感受柔潤",
    "日本原裝進口，大阪門市直接取貨",
    "精華液質地清爽，服貼不滑落",
  ];

  const wholesale = [
    `🇯🇵 大阪直送｜${brand}`,
    features[0],
    input.wholesaleTwd ? `批發價 NT$${input.wholesaleTwd} 起（${input.moq ?? 12} 件起批）` : "",
    "數量有限，意者私訊",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    name,
    description,
    specifications: specLines.join("\n"),
    features,
    targetAudience: ["日常保養族群", "喜歡日系保養品的人"],
    wholesaleCaption: wholesale,
  };
}

/**
 * 產生文案：優先用 AI，失敗則退回模板。
 * 兩種路徑都會經過法遵過濾，所以永遠不會產出違規內容。
 */
export async function generateCopy(input: CopyInput): Promise<CopyOutput> {
  const prompt = [
    "請為自家網站的商品頁寫文案。",
    "",
    "商品資料（來自照片辨識，可能不完整；null 代表沒讀到，不要自己編）：",
    JSON.stringify(
      {
        brand: input.brand,
        nameZh: input.nameZh,
        nameJa: input.nameJa,
        series: input.series,
        volumeMl: input.volumeMl,
        sheetsPerPack: input.sheetsPerPack,
        piecesPerBox: input.piecesPerBox,
        ingredients: input.ingredients.slice(0, 30),
        keyIngredients: input.keyIngredients,
        benefits: input.benefits,
        usageText: input.usageText,
        cautionText: input.cautionText,
        origin: input.origin,
        manufacturer: input.manufacturer,
        shelfLifeMonths: input.shelfLifeMonths,
        priceJpyVisible: input.priceJpyVisible,
        retailTwd: input.retailTwd,
        wholesaleTwd: input.wholesaleTwd,
        moq: input.moq,
      },
      null,
      2,
    ),
    "",
    "輸出 JSON 欄位：",
    JSON.stringify(OUTPUT_SPEC, null, 2),
  ].join("\n");

  const ai = await callMistral(prompt);
  let base: Omit<CopyOutput, "compliance" | "generated">;
  let generated = false;
  let model: string | undefined;
  let error: string | undefined;

  if ("error" in ai) {
    base = templateCopy(input);
    error = ai.error;
  } else {
    const parsed = parseJson(ai.text);
    if (!parsed) {
      base = templateCopy(input);
      error = "AI 回覆無法解析為 JSON";
    } else {
      base = {
        name: str(parsed.name, templateCopy(input).name),
        description: str(parsed.description, templateCopy(input).description),
        specifications: str(parsed.specifications, templateCopy(input).specifications),
        features: strArray(parsed.features).length ? strArray(parsed.features) : templateCopy(input).features,
        targetAudience: strArray(parsed.targetAudience),
        wholesaleCaption: str(parsed.wholesaleCaption, templateCopy(input).wholesaleCaption),
      };
      generated = true;
      model = ai.model;
    }
  }

  return { ...applyCompliance(base, input.brand), generated, model, error };
}

/** 對所有文字欄位跑法遵過濾，並回報改了什麼 */
export function applyCompliance(
  base: Omit<CopyOutput, "compliance" | "generated">,
  brand: string | null = null,
): Omit<CopyOutput, "compliance" | "generated"> & { compliance: CopyOutput["compliance"] } {
  const findings: Array<Finding & { source: string }> = [];
  const replacements: Array<{ source: string; from: string; to: string }> = [];

  const clean = (source: string, value: string): string => {
    if (!value) return value;
    for (const f of scanText(value)) findings.push({ ...f, source });
    const { text, replacements: r } = sanitizeText(value);
    for (const item of r) replacements.push({ source, from: item.from, to: item.to });
    return text;
  };

  const cleaned = {
    name: normalizeProductName(clean("name", base.name), brand),
    description: clean("description", base.description),
    specifications: clean("specifications", base.specifications),
    features: base.features.map((f) => clean("features", f)),
    targetAudience: base.targetAudience.map((a) => clean("targetAudience", a)),
    wholesaleCaption: clean("wholesaleCaption", base.wholesaleCaption),
  };

  const blocking = findings.filter((f) => f.severity === "block");

  return {
    ...cleaned,
    compliance: {
      status: blocking.length > 0 ? "auto_corrected" : "clean",
      findings,
      replacements,
    },
  };
}

/** 只用於測試或檢查：列出所有違規字眼（不修改） */
export function inspectCopy(text: string): Finding[] {
  return scanText(text, BLOCKING_RULES);
}
