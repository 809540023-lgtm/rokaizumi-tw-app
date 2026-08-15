/**
 * 把 products.json 匯入資料庫
 *
 * 用法（在 Render Shell 執行，那裡已有 DATABASE_URL）：
 *   node scripts/seed-products.mjs
 *
 * 會先建立分類、再匯入商品。重複執行安全：以商品名稱判斷是否已存在，
 * 已存在就更新，不會產生重複資料。
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('❌ 找不到 DATABASE_URL');
  process.exit(1);
}

// 公網託管的資料庫（TiDB Cloud 等）強制要求 TLS
function poolConfig(u) {
  let host = '';
  try {
    host = new URL(u).hostname;
  } catch {}
  const internal =
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  return internal ? u : { uri: u, ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } };
}

function findProducts() {
  const candidates = [
    'dist/public/products.json',
    'server/public/products.json',
    'client/public/products.json',
  ].map(p => path.resolve(process.cwd(), p));
  const hit = candidates.find(p => fs.existsSync(p));
  if (!hit) throw new Error('找不到 products.json');
  return hit;
}

const conn = await mysql.createConnection(poolConfig(url));
console.log('✅ 已連線');

const file = findProducts();
const products = JSON.parse(fs.readFileSync(file, 'utf-8'));
console.log(`📦 讀取 ${products.length} 筆商品 (${file})`);

// ---- 分類 ----
const names = [...new Set(products.map(p => p.category).filter(Boolean))];
for (const name of names) {
  await conn.execute(
    'INSERT INTO categories (name, description) SELECT ?, ? FROM DUAL ' +
      'WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = ?)',
    [name, `分類: ${name}`, name]
  );
}
const [catRows] = await conn.query('SELECT id, name FROM categories');
const catId = new Map(catRows.map(r => [r.name, r.id]));
console.log(`✅ 分類 ${catId.size} 個`);

// ---- 商品 ----
let inserted = 0;
let updated = 0;
for (const p of products) {
  const cid = catId.get(p.category);
  if (!cid) continue;

  const [exist] = await conn.execute('SELECT id FROM products WHERE name = ? LIMIT 1', [p.name]);

  if (exist.length) {
    await conn.execute(
      'UPDATE products SET price = ?, categoryId = ?, imageUrl = ?, images = ?, status = ?, specifications = ? WHERE id = ?',
      [
        p.price ?? 0,
        cid,
        p.imageUrl ?? '',
        JSON.stringify(p.images ?? []),
        p.status ?? 'available',
        p.specifications ?? '',
        exist[0].id,
      ]
    );
    updated++;
  } else {
    await conn.execute(
      'INSERT INTO products (name, description, price, categoryId, imageUrl, images, status, specifications, stock) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        p.name,
        p.description ?? '',
        p.price ?? 0,
        cid,
        p.imageUrl ?? '',
        JSON.stringify(p.images ?? []),
        p.status ?? 'available',
        p.specifications ?? '',
        99,
      ]
    );
    inserted++;
  }
  if ((inserted + updated) % 200 === 0) {
    console.log(`   進度 ${inserted + updated}/${products.length}`);
  }
}

const [[{ n }]] = await conn.query('SELECT COUNT(*) n FROM products');
console.log(`\n✅ 完成：新增 ${inserted}、更新 ${updated}`);
console.log(`📊 資料庫現有商品：${n} 筆`);

await conn.end();
