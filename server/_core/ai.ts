import type { Express, Request, Response } from "express";

/**
 * AI 選品助理：上傳商品照片/截圖，透過 Anthropic Claude 看圖辨識，
 * 產生「原創」的繁體中文商品草稿（品名、特色、說明、建議分類）。
 *
 * 重要：所有文案皆由模型用自己的話重新撰寫，不照抄任何網站既有文案。
 * 金鑰請放在 Render 環境變數 ANTHROPIC_API_KEY（程式不存明碼）。
 * 可用 AI_MODEL 環境變數指定模型，預設 claude-3-5-sonnet-latest。
 */

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

function extractJson(text: string): any | null {
  if (!text) return null;
  // 去除可能的 ```json ... ``` 圍欄
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
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) {
        res.status(503).json({
          ok: false,
          error: "尚未設定 AI 金鑰，請在 Render 環境變數新增 ANTHROPIC_API_KEY。",
        });
        return;
      }

      const body = await readJsonBody(req);
      let imageBase64: string = String(body.imageBase64 || "");
      let mediaType: string = String(body.mediaType || "image/jpeg");
      // 若前端傳來 data URL，拆出 base64 與 mime
      const m = imageBase64.match(/^data:([^;]+);base64,(.*)$/s);
      if (m) {
        mediaType = m[1];
        imageBase64 = m[2];
      }
      if (!imageBase64) {
        res.status(400).json({ ok: false, error: "缺少圖片資料。" });
        return;
      }

      const instruction =
        "你是專業的日本商品選品助理。請看這張商品照片或截圖，判斷這是什麼商品，" +
        "並用你自己的話、以繁體中文重新撰寫商品資訊（不要照抄任何網站既有文案）。" +
        "只輸出一個 JSON 物件，格式如下，不要有其他文字：\n" +
        '{"name":"商品名稱","features":["賣點1","賣點2","賣點3"],' +
        '"description":"一段約 80–150 字的商品說明","suggestedCategory":"建議分類","estimatedJPY":數字或null}';

      const model = process.env.AI_MODEL || "claude-3-5-sonnet-latest";

      let apiResp: Response | any;
      try {
        apiResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: mediaType, data: imageBase64 },
                  },
                  { type: "text", text: instruction },
                ],
              },
            ],
          }),
        });
      } catch (e) {
        res.json({ ok: false, error: "無法連線到 AI 服務，請稍後再試。" });
        return;
      }

      const data: any = await apiResp.json().catch(() => null);
      if (!apiResp.ok) {
        const msg = (data && (data.error?.message || data.message)) || "AI 服務回應錯誤";
        res.json({ ok: false, error: "AI 服務錯誤：" + String(msg).slice(0, 200) });
        return;
      }

      const text =
        (data && Array.isArray(data.content) && data.content.map((c: any) => c.text || "").join("\n")) ||
        "";
      const draft = extractJson(text);
      if (!draft) {
        res.json({ ok: false, error: "AI 回傳格式無法解析，請重試或改為手動填寫。", raw: text.slice(0, 300) });
        return;
      }

      res.json({
        ok: true,
        draft: {
          name: draft.name || "",
          features: Array.isArray(draft.features) ? draft.features : [],
          description: draft.description || "",
          suggestedCategory: draft.suggestedCategory || "",
          estimatedJPY: typeof draft.estimatedJPY === "number" ? draft.estimatedJPY : null,
        },
      });
    } catch (error) {
      console.error("[ai] product-draft error", error);
      res.json({ ok: false, error: "產生草稿時發生錯誤，請改為手動填寫。" });
    }
  });
}
