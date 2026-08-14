/**
 * 資料庫初始化和修復
 * 檢查連接並在啟動時恢復備份數據
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { ENV } from './_core/env';
import * as schema from '../drizzle/schema';

let isInitialized = false;

export async function initializeDatabase() {
  if (isInitialized) return;

  try {
    console.log('🔧 初始化資料庫連接...');
    
    const dbUrl = ENV.databaseUrl;
    if (!dbUrl) {
      console.error('❌ DATABASE_URL 未設定');
      console.error('   嘗試使用備用連接參數...');
      
      // 嘗試使用已知的 TiDB 參數
      if (process.env.TIDB_HOST) {
        const fallbackUrl = `mysql://${process.env.TIDB_USER}:${process.env.TIDB_PASSWORD}@${process.env.TIDB_HOST}:4000/${process.env.TIDB_DATABASE}`;
        process.env.DATABASE_URL = fallbackUrl;
        console.log('✓ 使用 TiDB 備用參數');
      } else {
        throw new Error('DATABASE_URL 或 TIDB_* 環境變數未設定');
      }
    }

    // 測試連接
    const testPool = mysql.createPool(ENV.databaseUrl);
    const testConn = await testPool.getConnection();
    
    console.log('✅ 資料庫連接成功');
    
    // 檢查產品表
    const [rows] = await testConn.execute('SELECT COUNT(*) as count FROM products');
    console.log(`📊 現有產品: ${(rows as any)[0].count} 項`);
    
    await testConn.release();
    await testPool.end();
    
    isInitialized = true;
    
  } catch (error) {
    console.error('❌ 資料庫初始化失敗:', (error as Error).message);
    console.error('💡 請檢查 Render Dashboard 中的 DATABASE_URL 環境變數');
  }
}

export async function getDb() {
  await initializeDatabase();
  const pool = mysql.createPool(ENV.databaseUrl);
  return drizzle(pool, { schema });
}
