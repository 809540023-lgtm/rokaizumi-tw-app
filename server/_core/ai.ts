import type { Express, Request, Response } from "express";

/**
 * AI 選品助理：上傳商品照片/截圖，透過 Mistral（Pixtral 視覺模型）看圖辨識，
 * 產生「原創」的繁體中文商品草稿（品名、特色、說明、建議分類）。
 *
 * 文案皆由模型用自己的話重新撰寫，不照抄任何網站既有文案。
 * 金鑰放 Render 環境變數 MISTRAL_API_KEY。
 * 預設自動輪流嘗試多個模型；也可用 AI_MODEL 指定單一模型。
 */

async function readJsonBody(req: Request): Promise<any> {
  // express.json() 已經在前面解析過 body 時，req.body 一定存在（可能是空物件），
  // 這裡必須直接回傳。原本的寫法在「body 是空物件」時會往下去讀 req 的資料流，
  // 但資料流早就被 express.json() 讀完了，於是 Promise 永遠不會 resolve，
  // 請求就這樣卡住不回應（實測 POST {} 會一直等到連線逾時）。
  if (req.body !== undefined && req.body !== null && typeof req.body === "object") {
    return req.body;
  }

  // 備援：只有當 body 完全沒有被解析過（例如路由掛在 body parser 之前）才手動讀，
  // 並且加上逾時，確保任何情況下都不會無限等待。
  return await new Promise((resolve) => {
    let data = "";
    const done = () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    };
    const timer = setTimeout(done, 10_000);
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      clearTimeout(timer);
      done();
    });
    req.on("error", () => {
      clearTimeout(timer);
      done();
    });
  });
}

function extractJson(text: string): any | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function registerAiRoutes(app: Express) {
  app.post("/api/ai/product-draft", async (req: Request, res: Response) => {
    try {
      const key = process.env.MISTRAL_API_KEY;
      if (!key) {
        res.status(503).json({
          ok: false,
          error: "尚未設定 AI 金鑰，請在 Render 環境變數新增 MISTRAL_API_KEY。",
        });
        return;
      }

      const body = await readJsonBody(req);
      let imageBase64: string = String(body.imageBase64 || "");
      let mediaType: string = String(body.mediaType || "image/jpeg");
      const dm = imageBase64.match(/^data:([^;]+);base64,([\s\S]*)$/);
      if (dm) {
        mediaType = dm[1];
        imageBase64 = dm[2];
      }
      if (!imageBase64) {
        res.status(400).json({ ok: false, error: "缺少圖片資料。" });
        return;
      }
      const dataUrl = "data:" + mediaType + ";base64," + imageBase64;

      const instruction =
        "你是專業的日本商品選品助理。請看這張商品照片或截圖，判斷這是什麼商品，" +
        "並用你自己的話、以繁體中文重新撰寫商品資訊（不要照抄任何網站既有文案）。" +
        "只輸出一個 JSON 物件，格式如下，不要有其他文字：\n" +
        '{"name":"商品名稱","features":["賣點1","賣點2","賣點3"],' +
        '"description":"一段約 80–150 字的商品說明","suggestedCategory":"建議分類","estimatedJPY":數字或null}';

      const models = process.env.AI_MODEL
        ? [process.env.AI_MODEL]
        : ["pixtral-12b-latest", "pixtral-large-latest", "pixtral-12b-2409"];

      const messages = [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: dataUrl },
          ],
        },
      ];

      let lastErr = "";
      let quotaHit = false;

      for (const model of models) {
        let apiResp: any;
        try {
          apiResp = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + key,
              "content-type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({ model, messages, max_tokens: 1024, temperature: 0.4 }),
          });
        } catch (e) {
          lastErr = "連線失敗";
          continue;
        }

        const data: any = await apiResp.json().catch(() => null);

        if (apiResp.ok) {
          const text = data?.choices?.[0]?.message?.content || "";
          const content = typeof text === "string" ? text : Array.isArray(text) ? text.map((p: any) => p.text || "").join("\n") : "";
          const draft = extractJson(content);
          if (!draft) {
            lastErr = "回傳格式無法解析";
            continue;
          }
          res.json({
            ok: true,
            model,
            draft: {
              name: draft.name || "",
              features: Array.isArray(draft.features) ? draft.features : [],
              description: draft.description || "",
              suggestedCategory: draft.suggestedCategory || "",
              estimatedJPY: typeof draft.estimatedJPY === "number" ? draft.estimatedJPY : null,
            },
          });
          return;
        }

        const msg = String(
          (data && (data.error?.message || data.message || data.detail)) || ("HTTP " + apiResp.status)
        );
        lastErr = msg;
        if (/quota|exceeded|rate|limit|capacity|429/i.test(msg) || apiResp.status === 429) quotaHit = true;
        if (apiResp.status === 401 || apiResp.status === 403) {
          res.json({ ok: false, error: "AI 金鑰無效或未授權，請確認 MISTRAL_API_KEY。" });
          return;
        }
      }

      res.json({
        ok: false,
        error: quotaHit
          ? "AI 服務暫時達到使用上限，請稍候再試。"
          : "AI 服務錯誤：" + lastErr.slice(0, 160),
      });
    } catch (error) {
      console.error("[ai] product-draft error", error);
      res.json({ ok: false, error: "產生草稿時發生錯誤，請改為手動填寫。" });
    }
  });
}
