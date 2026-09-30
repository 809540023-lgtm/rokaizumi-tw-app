/**
 * 階段待辦提醒。
 *
 * 把「每天／每週該做什麼」變成資料庫裡的任務，重複同步不會產生重複項目
 * （用 workflowKey + 到期時間當 dedupeKey）。
 *
 * 為什麼不用 cron 表達式？
 *   這裡的需求是「每隔 N 天／每週某天要做某件事」，用間隔天數描述
 *   比 5 欄位 cron 好懂也好維護；真的需要精準排程時再改用 cron 即可。
 *
 * 通知的部分：本專案已經有 Telegram bot（server/_core/telegramBot.ts），
 * 但需要 TELEGRAM_BOT_TOKEN。沒有 token 時任務仍然會建立，
 * 在後台「面膜作業」頁面上直接看得到。
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { maskTasks, masks } from "../../drizzle/schema";

export interface MaskWorkflow {
  key: string;
  title: string;
  detail: string;
  owner: string;
  /** 每幾天一次 */
  everyDays: number;
}

export const MASK_WORKFLOWS: MaskWorkflow[] = [
  {
    key: "jp_pickup",
    title: "日本大阪難波取貨",
    detail: [
      "1. 確認今日要補的 SKU 與數量",
      "2. 到難波門市取貨，現場拍正面、背面成分、外盒、質地",
      "3. 核對批號與保存期限，抄下來填進系統",
      "4. 照片丟進 Google 雲端資料夾，執行本機代理同步",
    ].join("\n"),
    owner: "日本採購",
    everyDays: 1,
  },
  {
    key: "consolidation",
    title: "集貨與裝箱",
    detail: [
      "1. 依 SKU 分箱、秤重、量材積",
      "2. 列印裝箱清單",
      "3. 確認液體航空限制與外箱標示",
    ].join("\n"),
    owner: "日本倉",
    everyDays: 3,
  },
  {
    key: "intl_shipping",
    title: "國際運輸回台灣",
    detail: [
      "1. 報關文件（進口報單、商業發票、裝箱清單）",
      "2. 確認是否需輸入查驗",
      "3. 追蹤貨態，抵台後點收入庫",
      "4. 更新商品庫存",
    ].join("\n"),
    owner: "物流",
    everyDays: 3,
  },
  {
    key: "tw_fulfillment",
    title: "台灣出貨與客服",
    detail: [
      "1. 處理當日訂單、撿貨、貼中文標籤",
      "2. 出貨並回壓物流單號",
      "3. 回覆成分／效期／用法詢問",
      "4. 檢查低庫存商品",
    ].join("\n"),
    owner: "台灣營運",
    everyDays: 2,
  },
  {
    key: "compliance_review",
    title: "法規與標示檢查",
    detail: [
      "1. 確認新品都已完成化粧品產品登錄",
      "2. 特定用途化粧品查驗登記字號是否有效",
      "3. 中文標示 11 項要素是否齊全（後台有檢核表）",
      "4. 產品資訊檔案（PIF）是否備齊",
    ].join("\n"),
    owner: "法遵",
    everyDays: 30,
  },
  {
    key: "weekly_review",
    title: "每週營運檢視",
    detail: [
      "1. 看毛利：哪個品項低於 20%",
      "2. 看匯率走勢，決定要不要調價",
      "3. 看滯銷庫存並規劃促銷",
    ].join("\n"),
    owner: "老闆",
    everyDays: 7,
  },
];

/** 依工作流程建立待辦；已存在（同 key 同到期時間）就跳過 */
export async function syncMaskTasks(): Promise<{ created: number; total: number }> {
  const now = new Date();
  let created = 0;

  for (const wf of MASK_WORKFLOWS) {
    const dueAt = new Date(now.getTime() + wf.everyDays * 24 * 60 * 60 * 1000);
    const dedupeKey = `${wf.key}@${dueAt.toISOString().slice(0, 10)}`;

    const existing = await db
      .select({ id: maskTasks.id })
      .from(maskTasks)
      .where(eq(maskTasks.dedupeKey, dedupeKey));
    if (existing.length > 0) continue;

    await db.insert(maskTasks).values({
      workflowKey: wf.key,
      title: wf.title,
      detail: wf.detail,
      owner: wf.owner,
      dueAt,
      dedupeKey,
      status: "pending",
    });
    created += 1;
  }

  const all = await db.select({ id: maskTasks.id }).from(maskTasks);
  return { created, total: all.length };
}

/** 低庫存面膜（已上架且庫存低於門檻），給提醒用 */
export async function lowStockMasks(threshold = 10): Promise<Array<{ sku: string; name: string; stock: number }>> {
  const rows = await db
    .select({ sku: masks.sku, name: masks.nameZh, stock: masks.stock })
    .from(masks)
    .where(eq(masks.status, "published"));

  return rows
    .filter((r: { stock: number | null }) => (r.stock ?? 0) <= threshold)
    .map((r: { sku: string; name: string; stock: number | null }) => ({
      sku: r.sku,
      name: r.name,
      stock: r.stock ?? 0,
    }));
}
