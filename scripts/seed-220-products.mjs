/**
 * 220 件 B 版線上商品的 seed 腳本（範例：分類 + 各分類 sample 商品）
 *
 * 完整 220 件資料量大，這份檔案做兩件事：
 *   1. 建立 11 個分類（與 B 版線上完全對應）
 *   2. 每個分類 seed 3-5 件代表商品作為展示 / 開發樣本
 *
 * 上線前要做完整 220 件：
 *   a. 把 /Users/.../uploads/rokaizumi_complete_backup.zip 解壓
 *   b. 在 A 版專案執行：
 *        node scripts/import-from-backup.mjs
 *      （或用您原本的後台「批次匯入」功能）
 *
 * 使用方式：
 *   cd 您的 A 版專案
 *   node scripts/seed-220-products.mjs
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

console.log('▶ 開始 seed v4 11 大分類 + 樣本商品...');

/* ---------- 11 大分類 ---------- */
const categories = [
  { name: '手杖・ステッキ',  icon: '🦯',  sortOrder: 1 },
  { name: '歩行器・移動補助', icon: '🚶',  sortOrder: 2 },
  { name: '介護靴・ケアシューズ', icon: '👟', sortOrder: 3 },
  { name: '車椅子・移乗支援', icon: '🦽',  sortOrder: 4 },
  { name: '入浴・お風呂用品', icon: '🚿',  sortOrder: 5 },
  { name: 'おトイレ・排せつ', icon: '🚽',  sortOrder: 6 },
  { name: '大人用おむつ用品', icon: '📦',  sortOrder: 7 },
  { name: '介護ベッド・寝具', icon: '🛏️', sortOrder: 8 },
  { name: '床ずれ(褥瘡)対策', icon: '🛡️', sortOrder: 9 },
  { name: '手すり',           icon: '🤲',  sortOrder: 10 },
  { name: '介護用食器・エプロン', icon: '🥢', sortOrder: 11 },
];

const catIds = {};
for (const c of categories) {
  const [r] = await conn.execute(
    `INSERT INTO categories (name, icon, sort_order)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE icon = VALUES(icon), sort_order = VALUES(sort_order)`,
    [c.name, c.icon, c.sortOrder]
  );
  const [rows] = await conn.execute('SELECT id FROM categories WHERE name = ?', [c.name]);
  catIds[c.name] = rows[0].id;
}
console.log('✓ 11 大分類已建立');

/* ---------- 樣本商品（44 件，每類 4 件） ---------- */
const products = [
  // 杖
  { cat: '手杖・ステッキ', sku: 'SCRIO_gd19783', brand: 'CarbonFiber', name: 'カーボンファイバー杖（固定型）', price: 10010, salesCount: 89, rating: 4.9, reviewCount: 218 },
  { cat: '手杖・ステッキ', sku: 'SCRIO_gd13962', brand: 'Ultra Legere', name: 'ウルトラ・レジェール 一本杖 耐荷重120kg', price: 21450, salesCount: 145, rating: 4.8, reviewCount: 162 },
  { cat: '手杖・ステッキ', sku: 'SCRIO_8430', brand: 'maple wood', name: '楓木製杖 T字 紳士用 長さ90cm', price: 7150, salesCount: 230, rating: 4.7, reviewCount: 98 },
  { cat: '手杖・ステッキ', sku: 'SCRIO_gd19910', brand: '花KOMON', name: '花KOMON 折り畳み 伸縮杖 和柄', price: 25025, salesCount: 67, rating: 5.0, reviewCount: 41 },

  // 歩行器
  { cat: '歩行器・移動補助', sku: 'SCRIO_gd19831', brand: 'Sunny Walker', name: 'サニーウォーカー AW-Ⅲ コンパクトタイプ', price: 34892, salesCount: 122, rating: 4.7, reviewCount: 88 },
  { cat: '歩行器・移動補助', sku: 'SCRIO_gd19830', brand: 'Forte', name: 'フォルテ シルバーカー ワンタッチ座面', price: 50050, salesCount: 76, rating: 4.8, reviewCount: 54 },
  { cat: '歩行器・移動補助', sku: 'SCRIO_gd19683', brand: 'Noble', name: 'ノーブルワゴンM 大容量ワゴンタイプ', price: 41899, salesCount: 98, rating: 4.6, reviewCount: 72 },
  { cat: '歩行器・移動補助', sku: 'SCRIO_gd18355', brand: 'Benri', name: 'Benriベンリー コンパクトシルバーカー', price: 35750, salesCount: 134, rating: 4.7, reviewCount: 105 },

  // 介護靴
  { cat: '介護靴・ケアシューズ', sku: 'SCRIO_gd19991', brand: '徳武産業', name: '瞬感スポっと 5E 両足販売 4L-5L', price: 12155, salesCount: 312, rating: 4.9, reviewCount: 276 },
  { cat: '介護靴・ケアシューズ', sku: 'SCRIO_gd19994', brand: 'タウニー', name: 'タウニークラブ ライトフリー 外反母趾対応', price: 9867, salesCount: 198, rating: 4.8, reviewCount: 142 },
  { cat: '介護靴・ケアシューズ', sku: 'SCRIO_gd19816', brand: 'アシックス', name: 'アシックス ライフウォーカー 1242A018', price: 11297, salesCount: 245, rating: 4.7, reviewCount: 187 },
  { cat: '介護靴・ケアシューズ', sku: 'SCRIO_gd19979', brand: '徳武産業', name: 'ダブルマジックⅢ凛 3E 両足販売', price: 9867, salesCount: 178, rating: 4.8, reviewCount: 124 },

  // 車椅子
  { cat: '車椅子・移乗支援', sku: 'SCRIO_gd19904', brand: 'ミキ', name: 'NEOシリーズ 介助用 NEO-2 ノーパンクタイヤ', price: 100230, salesCount: 67, rating: 4.9, reviewCount: 58, isTaxExempt: 0 },
  { cat: '車椅子・移乗支援', sku: 'SCRIO_gd19810', brand: 'ミキ', name: 'NEOβ NEO-2β 介助用車椅子 40cm幅', price: 110500, salesCount: 54, rating: 4.9, reviewCount: 42, isTaxExempt: 1 },
  { cat: '車椅子・移乗支援', sku: 'SCRIO_gd19627', brand: 'ミキ', name: 'NEXTROLLER_sp Ⅱ 座面昇降型リクライニング', price: 373100, salesCount: 18, rating: 5.0, reviewCount: 12, isTaxExempt: 1 },
  { cat: '車椅子・移乗支援', sku: 'SCRIO_gd19613', brand: 'ミキ', name: 'カルッタ介助式 CRT-SG-2 軽量コンパクト', price: 197600, salesCount: 32, rating: 4.8, reviewCount: 24, isTaxExempt: 1 },

  // 入浴
  { cat: '入浴・お風呂用品', sku: 'SCRIO_gd19529', brand: 'ウチエ', name: 'シャトレチェアD 4輪自在 穴無しシート', price: 160160, salesCount: 28, rating: 4.9, reviewCount: 22 },
  { cat: '入浴・お風呂用品', sku: 'SCRIO_gd19091', brand: 'ウーゴ君', name: '移動もできるシャワーチェア ウーゴ君', price: 125840, salesCount: 41, rating: 4.8, reviewCount: 31 },
  { cat: '入浴・お風呂用品', sku: 'SCRIO_gd16608', brand: 'ウチエ', name: 'くるくるチェアD O型座面 KRU-172', price: 157300, salesCount: 35, rating: 4.9, reviewCount: 28 },
  { cat: '入浴・お風呂用品', sku: 'SCRIO_gd17449', brand: '睦三', name: 'シャワーキャリー SW-11S デラックスタイプ', price: 235950, salesCount: 18, rating: 4.9, reviewCount: 15 },

  // おトイレ
  { cat: 'おトイレ・排せつ', sku: 'SCRIO_gd19678', brand: '安寿', name: '家具調トイレセレクトR ワイド幅 暖房・脱臭', price: 66066, salesCount: 87, rating: 4.8, reviewCount: 68 },
  { cat: 'おトイレ・排せつ', sku: 'SCRIO_gd18568', brand: '安寿', name: 'ポータブルトイレFX-30 らくゾウくん', price: 32019, salesCount: 142, rating: 4.7, reviewCount: 96 },
  { cat: 'おトイレ・排せつ', sku: 'SCRIO_gd18231', brand: 'ラップポン', name: '自動ラップ式トイレ ラップポン・プリート(S)', price: 194480, salesCount: 24, rating: 4.9, reviewCount: 18 },
  { cat: 'おトイレ・排せつ', sku: 'SCRIO_gd18514', brand: 'さわやかあさひ', name: 'さわやかあさひ 家具調ポータブルトイレ', price: 98670, salesCount: 56, rating: 4.7, reviewCount: 42 },

  // 大人用おむつ
  { cat: '大人用おむつ用品', sku: 'SCRIO_gd18564', brand: 'ライフリー', name: 'ライフリー 快適さらさらカバータイプ 1ケース 22枚×4袋', price: 13670, salesCount: 412, rating: 4.6, reviewCount: 312 },
  { cat: '大人用おむつ用品', sku: 'SCRIO_gd16659', brand: 'ライフリー', name: 'ズレずに安心紙パンツ 超熟睡あんしん 1200cc 1ケース', price: 8377, salesCount: 386, rating: 4.7, reviewCount: 287 },
  { cat: '大人用おむつ用品', sku: 'SCRIO_gd15703', brand: 'アクティ', name: 'アクティはけるパンツ スーパー XLサイズ 6袋', price: 21278, salesCount: 198, rating: 4.6, reviewCount: 142 },
  { cat: '大人用おむつ用品', sku: 'SCRIO_gd15017', brand: 'リブドゥ', name: 'リブドゥ Gはくパンツスリム 6袋', price: 29100, salesCount: 156, rating: 4.7, reviewCount: 102 },

  // 介護ベッド
  { cat: '介護ベッド・寝具', sku: 'SCRIO_gd19648', brand: 'EnergyFront', name: 'リフティ・ピーヴォセット 移乗介助', price: 42900, salesCount: 38, rating: 4.9, reviewCount: 27 },
  { cat: '介護ベッド・寝具', sku: 'SCRIO_gd19796', brand: 'ウェルファン', name: 'デニム防水シーツ 2枚組 標準タイプ', price: 10725, salesCount: 234, rating: 4.7, reviewCount: 168 },
  { cat: '介護ベッド・寝具', sku: 'SCRIO_gd19798', brand: '大阪エンゼル', name: 'ホームケア防水全面シーツ 全身タイプ', price: 12870, salesCount: 187, rating: 4.8, reviewCount: 124 },
  { cat: '介護ベッド・寝具', sku: 'SCRIO_8484', brand: 'テイコブ', name: 'スライディングシート 移乗補助', price: 13585, salesCount: 156, rating: 4.7, reviewCount: 98 },

  // 床ずれ
  { cat: '床ずれ(褥瘡)対策', sku: 'SCRIO_gd19818', brand: 'ウェルファン', name: 'ナーシングラッグ マットレス NRM-01', price: 429000, salesCount: 12, rating: 5.0, reviewCount: 9, isTaxExempt: 1 },
  { cat: '床ずれ(褥瘡)対策', sku: 'SCRIO_gd14485', brand: 'シルバラード', name: 'シルバラード ベッドパッド 2DK 床ずれ予防羊毛', price: 85800, salesCount: 24, rating: 4.9, reviewCount: 18 },
  { cat: '床ずれ(褥瘡)対策', sku: 'SCRIO_gd19967', brand: 'ウェルファン', name: 'NR角座カルファクッション 体圧分散 床ずれ防止', price: 28600, salesCount: 89, rating: 4.8, reviewCount: 62 },
  { cat: '床ずれ(褥瘡)対策', sku: 'SCRIO_7987', brand: 'ナーシングラッグ', name: '尖足防止プロテクター NR-13 両足用', price: 55770, salesCount: 34, rating: 4.9, reviewCount: 24 },

  // 手すり
  { cat: '手すり', sku: 'SCRIO_gd20037', brand: 'タッチ・ドゥ', name: '面タッチ・ドゥ TM-380D 面手すり', price: 78650, salesCount: 28, rating: 4.8, reviewCount: 19 },
  { cat: '手すり', sku: 'SCRIO_gd17945', brand: 'TOTO', name: 'TOTOインテリア・バー Lタイプ 80×60cm', price: 27027, salesCount: 87, rating: 4.9, reviewCount: 68 },
  { cat: '手すり', sku: 'SCRIO_gd17891', brand: 'リッチェル', name: 'リッチェル 浴そう手すりX 在来工法130', price: 35750, salesCount: 56, rating: 4.8, reviewCount: 42 },
  { cat: '手すり', sku: 'SCRIO_gd17228', brand: 'たちあっぷ', name: 'たちあっぷⅡ 浴室用L型 CKA-Y23', price: 202488, salesCount: 14, rating: 4.9, reviewCount: 11 },

  // 食器・エプロン
  { cat: '介護用食器・エプロン', sku: 'SCRIO_gd14872', brand: 'すべり止め', name: 'すべり止めシートロール 2メートル L531', price: 14014, salesCount: 245, rating: 4.7, reviewCount: 178 },
  { cat: '介護用食器・エプロン', sku: 'SCRIO_gd17326', brand: '夢食器', name: '夢食器虹彩レインボウ 正角盆 No.8', price: 12441, salesCount: 87, rating: 4.6, reviewCount: 64 },
  { cat: '介護用食器・エプロン', sku: 'SCRIO_gd15326', brand: '介護食器', name: '曲げ曲げハンドル スプーン大 2本セット', price: 8151, salesCount: 198, rating: 4.8, reviewCount: 132 },
  { cat: '介護用食器・エプロン', sku: 'SCRIO_gd15136', brand: '箸ぞうくん', name: '箸ぞうくん S2-9 介護箸', price: 5291, salesCount: 312, rating: 4.7, reviewCount: 246 },
];

for (const p of products) {
  await conn.execute(
    `INSERT INTO products
       (category_id, sku, brand, name, name_ja, price, original_price, sales_count, rating, review_count, is_tax_exempt, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', NOW())
     ON DUPLICATE KEY UPDATE
       price = VALUES(price),
       sales_count = VALUES(sales_count),
       rating = VALUES(rating),
       review_count = VALUES(review_count)`,
    [
      catIds[p.cat],
      p.sku,
      p.brand,
      p.name, // 中文 / 通用名
      p.name, // name_ja 直接放日文原名
      p.price,
      Math.round(p.price * 1.18), // 預設 original_price = 訂價 +18% 表示折扣
      p.salesCount ?? 0,
      p.rating ?? 0,
      p.reviewCount ?? 0,
      p.isTaxExempt ?? 0,
    ]
  );
}
console.log(`✓ ${products.length} 件樣本商品已 seed`);

await conn.end();
console.log('全部完成 ✅');
