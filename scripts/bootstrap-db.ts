/**
 * 建立資料庫結構（測試用）。
 *
 * 應用程式啟動時也會呼叫 bootstrapDatabase()，但那是 fire-and-forget：
 * 測試常常在資料表建好之前就開始查詢，於是全部退回靜態資料或直接失敗。
 * 因此 `pnpm test` 會先跑這支腳本，確保 schema 就緒後才執行 vitest。
 *
 * 沒有 DATABASE_URL 時（本機沒接資料庫）直接跳過，讓純單元測試仍可執行。
 */
import mysql from 'mysql2/promise';
import { bootstrapDatabase } from '../server/bootstrap-db';

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn('⚠️  未設定 DATABASE_URL，略過資料庫結構建立');
  process.exit(0);
}

const pool = mysql.createPool({ uri: url, connectionLimit: 2 });

try {
  // bootstrapDatabase 內部只記錄錯誤、不拋出，因此後面要自己驗證結果。
  await bootstrapDatabase(pool);

  const [rows]: any = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'orders'"
  );
  if (Number(rows?.[0]?.n ?? 0) === 0) {
    console.error('❌ orders 資料表未建立，測試無法執行');
    process.exit(1);
  }

  console.log('✅ 測試資料庫結構就緒');
} catch (error) {
  console.error('❌ 建立資料庫結構失敗:', (error as Error).message);
  process.exit(1);
} finally {
  await pool.end();
}
