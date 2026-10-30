import { Telegraf, Markup, type Context } from "telegraf";
import { message } from "telegraf/filters";
import axios from "axios";
import {
  MAX_PRODUCT_PRICE_TWD,
  MAX_PRODUCT_STOCK,
  SHOP_CATALOGS,
  createShopProduct,
  saveShopImage,
  type ShopCatalog,
} from "./line-shop";
import { ShopInputError } from "./line-shop-pricing";

// 商店首頁把商品分四區，機器人上架時只能挑這四種，否則前台不會顯示。
export const CATALOG_LABELS: Record<ShopCatalog, string> = {
  shop: "日本選品",
  supermarket: "日本超市",
  costco: "好市多",
  exclusive: "獨家",
};

export type Draft = {
  step: "catalog" | "name" | "price" | "stock" | "desc" | "photo" | "confirm";
  catalog?: ShopCatalog;
  name?: string;
  price?: number;
  stock?: number;
  desc?: string;
  image?: string;
};

// 「150」「NT$150」「1,200元」都收，小數與 0 一律擋掉。
export function parsePrice(text: string): number | null {
  const match = /^(?:nt\$|\$)?\s*(\d[\d,]*)\s*(?:元|twd)?$/i.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isSafeInteger(value)) return null;
  return value >= 1 && value <= MAX_PRODUCT_PRICE_TWD ? value : null;
}

export function parseStock(text: string): number | null {
  const match = /^(\d[\d,]*)$/.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  if (!Number.isSafeInteger(value)) return null;
  return value >= 0 && value <= MAX_PRODUCT_STOCK ? value : null;
}

export function summaryText(draft: Draft) {
  return [
    "📋 確認上架內容",
    "",
    `分類：${draft.catalog ? CATALOG_LABELS[draft.catalog] : "—"}`,
    `名稱：${draft.name ?? "—"}`,
    `價格：${draft.price === undefined ? "—" : `NT$${draft.price}`}`,
    `庫存：${draft.stock ?? "—"} 件`,
    `說明：${draft.desc || "（未填）"}`,
    `照片：${draft.image ? "1 張" : "（未上傳）"}`,
  ].join("\n");
}

// 只有名單裡的人能上架。沒設名單時機器人只回覆「你的 ID 是多少」，
// 不會讓任何人寫入商品。
export function shopBotAdminIds() {
  return String(process.env.TELEGRAM_ADMIN_IDS || "")
    .split(/[\s,]+/)
    .map(id => id.trim())
    .filter(Boolean);
}

const catalogKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback(CATALOG_LABELS.shop, "cat:shop"),
    Markup.button.callback(CATALOG_LABELS.supermarket, "cat:supermarket"),
  ],
  [
    Markup.button.callback(CATALOG_LABELS.costco, "cat:costco"),
    Markup.button.callback(CATALOG_LABELS.exclusive, "cat:exclusive"),
  ],
]);
const confirmKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("✅ 確認上架", "publish"),
    Markup.button.callback("❌ 取消", "discard"),
  ],
]);

export function initShopTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log("Telegram 上架機器人未啟動：沒有 TELEGRAM_BOT_TOKEN");
    return null;
  }
  const admins = shopBotAdminIds();
  const bot = new Telegraf(token);
  const drafts = new Map<number, Draft>();

  async function allowed(ctx: Context) {
    const id = ctx.from?.id;
    if (!admins.length) {
      await ctx.reply(
        "⚠️ 還沒設定誰可以用這個機器人。\n\n" +
          `你的 Telegram ID：${id ?? "（拿不到）"}\n\n` +
          "到 Render → 服務 → Environment 加上 TELEGRAM_ADMIN_IDS，" +
          "值就是上面這個號碼，存檔重新部署後就能上架。"
      );
      return false;
    }
    if (!id || !admins.includes(String(id))) {
      await ctx.reply("這個機器人只給店主使用。");
      return false;
    }
    return true;
  }

  bot.start(async ctx => {
    if (!(await allowed(ctx))) return;
    const id = ctx.from?.id;
    if (id) drafts.set(id, { step: "catalog" });
    await ctx.reply(
      "👋 上架新商品\n\n先選要放在商店的哪一區：",
      catalogKeyboard
    );
  });

  bot.command("id", async ctx => {
    await ctx.reply(`你的 Telegram ID：${ctx.from?.id ?? "未知"}`);
  });

  bot.command("cancel", async ctx => {
    const id = ctx.from?.id;
    if (id) drafts.delete(id);
    await ctx.reply("已取消。要重新開始請輸入 /start");
  });

  bot.help(async ctx => {
    await ctx.reply(
      "📖 商品上架機器人\n\n" +
        "/start — 上架新商品\n" +
        "/cancel — 取消目前這筆\n" +
        "/id — 顯示你的 Telegram ID\n\n" +
        "上架後的商品會直接出現在 LINE 商店，也可以再到後台調整。"
    );
  });

  bot.action(/^cat:(.+)$/, async ctx => {
    if (!(await allowed(ctx))) return;
    const id = ctx.from?.id;
    const catalog = String(ctx.match?.[1] ?? "");
    if (!id || !SHOP_CATALOGS.includes(catalog as ShopCatalog)) return;
    drafts.set(id, { step: "name", catalog: catalog as ShopCatalog });
    await ctx.answerCbQuery();
    await ctx.editMessageText(
      `✅ 分類：${CATALOG_LABELS[catalog as ShopCatalog]}\n\n請輸入商品名稱（客人看到的名字）：`
    );
  });

  bot.on(message("text"), async ctx => {
    const id = ctx.from?.id;
    if (!id) return;
    const text = ctx.message.text.trim();
    // 指令交給上面幾個 handler，這裡只處理欄位輸入。
    if (text.startsWith("/")) return;
    if (!(await allowed(ctx))) return;

    const draft = drafts.get(id);
    if (!draft) {
      await ctx.reply("要上架新商品請輸入 /start");
      return;
    }

    switch (draft.step) {
      case "name": {
        if (text.length < 2 || text.length > 120) {
          await ctx.reply("品名請填 2–120 字");
          return;
        }
        drafts.set(id, { ...draft, step: "price", name: text });
        await ctx.reply(`✅ ${text}\n\n售價多少台幣？（整數，不用打 NT$）`);
        return;
      }
      case "price": {
        const price = parsePrice(text);
        if (price === null) {
          await ctx.reply(`請輸入 1–${MAX_PRODUCT_PRICE_TWD} 的整數金額`);
          return;
        }
        drafts.set(id, { ...draft, step: "stock", price });
        await ctx.reply(`✅ NT$${price}\n\n庫存幾件？（0 表示先不開賣）`);
        return;
      }
      case "stock": {
        const stock = parseStock(text);
        if (stock === null) {
          await ctx.reply(`請輸入 0–${MAX_PRODUCT_STOCK} 的整數`);
          return;
        }
        drafts.set(id, { ...draft, step: "desc", stock });
        await ctx.reply(`✅ ${stock} 件\n\n一句話介紹這個商品（客人會看到）：`);
        return;
      }
      case "desc": {
        if (text.length > 1000) {
          await ctx.reply("說明最多 1000 字");
          return;
        }
        drafts.set(id, { ...draft, step: "photo", desc: text });
        await ctx.reply("✅ 說明已記下\n\n最後傳一張商品照片（或輸入「跳過」）：");
        return;
      }
      case "photo": {
        if (text !== "跳過") {
          await ctx.reply("請傳一張照片，或輸入「跳過」");
          return;
        }
        drafts.set(id, { ...draft, step: "confirm" });
        await ctx.reply(summaryText(draft), confirmKeyboard);
        return;
      }
      case "confirm":
        await ctx.reply("請按上面的「確認上架」或「取消」。");
        return;
      default:
        await ctx.reply("請先選一個分類：", catalogKeyboard);
    }
  });

  bot.on(message("photo"), async ctx => {
    const id = ctx.from?.id;
    if (!id) return;
    if (!(await allowed(ctx))) return;

    const draft = drafts.get(id);
    if (!draft || draft.step !== "photo") {
      await ctx.reply("請先輸入 /start 開始上架");
      return;
    }

    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const link = await ctx.telegram.getFileLink(photo.file_id);
      const response = await axios.get<ArrayBuffer>(link.href, {
        responseType: "arraybuffer",
        timeout: 30000,
        maxContentLength: 8 * 1024 * 1024,
      });
      const image = await saveShopImage(Buffer.from(response.data));
      const next: Draft = { ...draft, step: "confirm", image };
      drafts.set(id, next);
      await ctx.reply(summaryText(next), confirmKeyboard);
    } catch (error) {
      console.error("[shop-bot] 圖片處理失敗", error);
      await ctx.reply(
        `❌ ${error instanceof ShopInputError ? error.message : "圖片下載失敗，請再傳一次"}`
      );
    }
  });

  bot.action("publish", async ctx => {
    const id = ctx.from?.id;
    if (!id || !(await allowed(ctx))) return;

    const draft = drafts.get(id);
    if (!draft || draft.step !== "confirm" || !draft.catalog) {
      await ctx.answerCbQuery();
      await ctx.reply("這筆資料已過期，請重新 /start");
      return;
    }

    try {
      const product = await createShopProduct({
        name: draft.name ?? "",
        price: draft.price ?? 0,
        stock: draft.stock ?? 0,
        catalog: draft.catalog,
        desc: draft.desc ?? "",
        image: draft.image ?? "",
      });
      drafts.delete(id);
      await ctx.answerCbQuery("已上架");
      await ctx.editMessageText(
        `✅ 已上架\n\n` +
          `商品編號：${product.id}\n` +
          `名稱：${product.name}\n` +
          `分類：${CATALOG_LABELS[product.catalog as ShopCatalog]}\n` +
          `價格：NT$${product.price}\n` +
          `庫存：${product.stock} 件\n\n` +
          `前台：https://rokaizumi-tw.jp/line-shop/\n` +
          `後台再調整：https://rokaizumi-tw.jp/line-shop/admin.html`
      );
    } catch (error) {
      console.error("[shop-bot] 上架失敗", error);
      await ctx.answerCbQuery();
      await ctx.reply(
        `❌ ${error instanceof ShopInputError ? error.message : "上架失敗，請再試一次"}`
      );
    }
  });

  bot.action("discard", async ctx => {
    const id = ctx.from?.id;
    if (id) drafts.delete(id);
    await ctx.answerCbQuery();
    await ctx.editMessageText("已取消。要重新開始請輸入 /start");
  });

  bot.catch((error, ctx) => {
    console.error("[shop-bot] 未預期的錯誤", error);
    void Promise.resolve(ctx.reply("❌ 系統忙碌，請再試一次")).catch(() => {});
  });

  void bot.telegram
    .setMyCommands([
      { command: "start", description: "上架新商品" },
      { command: "cancel", description: "取消目前這筆" },
      { command: "id", description: "顯示我的 Telegram ID" },
      { command: "help", description: "使用說明" },
    ])
    .catch(error => console.error("[shop-bot] 設定指令失敗", error));

  bot
    .launch({ dropPendingUpdates: true })
    .then(() =>
      console.log(`✅ Telegram 上架機器人已啟動（可上架名單 ${admins.length} 人）`)
    )
    .catch(error => console.error("❌ Telegram 上架機器人啟動失敗", error));

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));

  return bot;
}
