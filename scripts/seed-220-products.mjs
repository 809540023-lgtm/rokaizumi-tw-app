/**
 * Seed 腳本（PostgreSQL 版）
 * - 從線上靜態資料 https://rokaizumi-tw.jp/data/products.json 讀取 220 件「真實商品」
 * - 建立分類 + 灌入商品（銷量/評價皆為 0，誠實呈現新站狀態）
 *
 * 用法（在 Render Shell 或本機，DATABASE_URL 已設定）：
 *   node scripts/seed-220-products.mjs
 */
import 'dotenv/config';
import postgres from 'postgres';

const DATA_URL = 'https://rokaizumi-tw.jp/data/products.json';

const CATEGORY_ICONS = {
  '杖(つえ・ステッキ)': '🦯',
  '歩行器・移動補助': '🚶',
  '介護靴・ケアシューズ': '👟',
  '車椅子・移乗支援': '🦽',
  '入浴・お風呂用品': '🚿',
  'おトイレ・排せつ': '🚽',
  '大人用おむつ用品': '📦',
  '介護ベッド・寝具': '🛏️',
  '床ずれ(褥瘡)対策': '🛡️',
  '手すり': '🤲',
  '介護用食器・エプロン': '🥢',
};

const sql = postgres(process.env.DATABASE_URL, { max: 5 });

console.log('▶ 下載線上商品資料...');
const res = await fetch(DATA_URL);
if (!res.ok) throw new Error('無法下載 products.json: ' + res.status);
const products = await res.json();
console.log(`✓ 取得 ${products.length} 件商品`);

// 依出現順序建立分類
const catNames = [...new Set(products.map((p) => p.category))];
const catIds = {};
let sortOrder = 1;
for (const name of catNames) {
  const rows = await sql`
    INSERT INTO categories (name, icon, "sortOrder", "createdAt", "updatedAt")
    VALUES (${name}, ${CATEGORY_ICONS[name] || '📦'}, ${sortOrder}, now(), now())
    ON CONFLICT (name) DO UPDATE SET icon = EXCLUDED.icon, "sortOrder" = EXCLUDED."sortOrder"
    RETURNING id`;
  catIds[name] = rows[0].id;
  sortOrder++;
}
console.log(`✓ ${catNames.length} 個分類已建立`);

let n = 0;
for (const p of products) {
  const stock = p.in_stock === false ? 0 : 50;
  await sql`
    INSERT INTO products
      (name, "nameJa", description, sku, price, "originalPrice", "categoryId",
       "imageUrl", status, stock, "salesCount", rating, "reviewCount", "isTaxExempt",
       "createdAt", "updatedAt")
    VALUES
      (${p.name}, ${p.name}, ${p.description || ''}, ${p.product_code},
       ${p.price_jpy}, ${p.original_price_jpy ?? null}, ${catIds[p.category]},
       ${p.image_url}, 'available', ${stock}, 0, 0, 0, false, now(), now())
    ON CONFLICT (sku) DO UPDATE SET
      name = EXCLUDED.name,
      price = EXCLUDED.price,
      "imageUrl" = EXCLUDED."imageUrl",
      "categoryId" = EXCLUDED."categoryId",
      stock = EXCLUDED.stock`;
  n++;
}
console.log(`✓ ${n} 件商品已 seed`);

await sql.end();
console.log('全部完成 ✅');
