/**
 * 資料庫開機自檢
 *
 * 全新的資料庫沒有任何資料表，即使連線成功，所有查詢仍會失敗並退回靜態檔。
 * Render 免付費方案沒有 One-off Jobs，Web Shell 也不便自動化，
 * 因此把「建表 + 首次匯入」放在啟動流程：偵測到缺表才執行，
 * 之後每次開機都會直接跳過。
 */

import fs from 'fs';
import path from 'path';

/** 資料表是否已存在 */
async function tableExists(pool: any, name: string): Promise<boolean> {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
    [name]
  );
  return Number(rows?.[0]?.n ?? 0) > 0;
}

/**
 * 讓 SQL 相容 TiDB。
 *
 * drizzle 會為 json 欄位產生 `DEFAULT ('[]')`，TiDB 不允許 json/blob/text
 * 使用預設值，整道 ALTER 會因語法錯誤失敗，導致 images 欄位建不出來，
 * 後續所有查詢（SELECT 會列出該欄位）跟著失敗。
 * 去掉預設值後結果一致——後面的 migration 本來就會 MODIFY 成無預設。
 */
function toTiDBCompatible(sql: string): string {
  return sql.replace(/(`?\w+`?\s+json)\s+DEFAULT\s*\([^)]*\)/gi, '$1');
}

/** 依序套用 drizzle 產生的 migration SQL */
async function applyMigrations(pool: any) {
  const dir = ['drizzle', '../drizzle', '../../drizzle']
    .map(d => path.resolve(process.cwd(), d))
    .find(d => fs.existsSync(d));

  if (!dir) {
    console.warn('⚠️  找不到 drizzle 目錄，略過建表');
    return;
  }

  const files = fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`🔧 開始建立資料表（${files.length} 個 migration）`);

  for (const file of files) {
    const sql = toTiDBCompatible(fs.readFileSync(path.join(dir, file), 'utf-8'));
    // drizzle 用 --> statement-breakpoint 分隔每一道 SQL
    const statements = sql
      .split(/--> statement-breakpoint/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (e: any) {
        // 欄位/資料表已存在屬正常（重複套用），其餘才需要記錄
        const code = e?.code ?? '';
        if (
          code === 'ER_TABLE_EXISTS_ERROR' ||
          code === 'ER_DUP_FIELDNAME' ||
          code === 'ER_DUP_KEYNAME' ||
          code === 'ER_CANT_DROP_FIELD_OR_KEY'
        ) {
          continue;
        }
        console.warn(`   ⚠️  ${file}: ${e.message?.slice(0, 100)}`);
      }
    }
  }
  console.log('✅ 資料表建立完成');
}

/** 商品表是空的就把 products.json 匯進去 */
async function seedProducts(pool: any) {
  const [[{ n }]]: any = await pool.query('SELECT COUNT(*) AS n FROM products');
  if (Number(n) > 0) {
    console.log(`ℹ️  資料庫已有 ${n} 筆商品，略過匯入`);
    return;
  }

  const file = ['dist/public/products.json', 'server/public/products.json', 'client/public/products.json']
    .map(p => path.resolve(process.cwd(), p))
    .find(p => fs.existsSync(p));

  if (!file) {
    console.warn('⚠️  找不到 products.json，略過匯入');
    return;
  }

  const products = JSON.parse(fs.readFileSync(file, 'utf-8'));
  console.log(`📦 匯入 ${products.length} 筆商品…`);

  const names = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
  for (const name of names) {
    await pool.query('INSERT INTO categories (name, description) VALUES (?, ?)', [
      name,
      `分類: ${name}`,
    ]);
  }
  const [cats]: any = await pool.query('SELECT id, name FROM categories');
  const catId = new Map(cats.map((c: any) => [c.name, c.id]));

  let done = 0;
  for (const p of products) {
    const cid = catId.get(p.category);
    if (!cid) continue;
    try {
      await pool.query(
        'INSERT INTO products (name, description, price, categoryId, imageUrl, images, status, specifications, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
      done++;
    } catch {
      /* 單筆失敗不中斷整批 */
    }
  }
  console.log(`✅ 已匯入 ${done} 筆商品、${catId.size} 個分類`);
}

/**
 * 啟動時呼叫。失敗只記錄不拋出——回退機制仍會讓網站正常運作，
 * 不該因為初始化問題導致整個服務起不來。
 */
export async function bootstrapDatabase(pool: any) {
  if (!pool) return;
  try {
    // 每次都完整套用一次 migration。已存在的資料表與欄位會被忽略，
    // 所以重複執行是安全的；而「表存在就整批跳過」的話，
    // 一旦某道 ALTER 曾經失敗（例如 TiDB 不接受的語法），
    // 缺掉的欄位就永遠補不回來。
    const fresh = !(await tableExists(pool, 'products'));
    console.log(fresh ? '🆕 偵測到全新資料庫，開始初始化' : '🔄 檢查資料表結構');
    await applyMigrations(pool);
    await seedProducts(pool);
  } catch (e) {
    console.error('❌ 資料庫初始化失敗:', (e as Error).message);
  }
}
