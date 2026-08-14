/**
 * 資料庫連接診斷和修復工具
 * 檢查並嘗試修復 Render 上的數據庫連接問題
 */

import { execSync } from 'child_process';

console.log('🔍 === 資料庫連接診斷 ===\n');

// 1. 檢查環境變數
console.log('1️⃣ 檢查環境變數...');
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.log('❌ DATABASE_URL 未設定');
  console.log('\n已知的 TiDB Cloud 連接信息:');
  console.log('  Host: gateway02.us-east-1.prod.aws.tidbcloud.com');
  console.log('  Port: 4000');
  console.log('  User: 3FVGt3RqCkiFaDE.0fde5e63513d');
  console.log('  Database: bMn2Gb7rjKtySEiV2r5RyX');
  console.log('  Password: [需要恢復或重新設定]');
  console.log('\n📋 正在檢查 Render 配置...');
  
  // 嘗試讀取 render.yaml
  try {
    const fs = require('fs');
    const yaml = fs.readFileSync('./render.yaml', 'utf-8');
    if (yaml.includes('DATABASE_URL')) {
      console.log('✓ render.yaml 中有 DATABASE_URL 配置');
    }
  } catch (e) {
    console.log('❌ 無法讀取 render.yaml');
  }
} else {
  console.log('✓ DATABASE_URL 已設定');
  // 隱藏密碼
  const masked = dbUrl.replace(/:[^@]+@/, ':***@');
  console.log(`  ${masked}`);
}

// 2. 測試連接（如果環境變數存在）
if (dbUrl) {
  console.log('\n2️⃣ 測試數據庫連接...');
  try {
    const mysql = await import('mysql2/promise');
    const pool = mysql.createPool(dbUrl);
    const conn = await pool.getConnection();
    console.log('✓ 數據庫連接成功！');
    
    // 查詢產品數量
    const [rows] = await conn.execute('SELECT COUNT(*) as count FROM products');
    console.log(`✓ 產品數量: ${rows[0].count}`);
    
    await conn.release();
  } catch (error) {
    console.log('❌ 數據庫連接失敗：', error.message);
  }
}

// 3. 檢查 .manus/db 中的舊數據
console.log('\n3️⃣ 檢查備份數據...');
try {
  const fs = require('fs');
  const path = require('path');
  const dbDir = './.manus/db';
  if (fs.existsSync(dbDir)) {
    const files = fs.readdirSync(dbDir).filter(f => f.startsWith('db-query-') && !f.includes('error'));
    console.log(`✓ 找到 ${files.length} 個備份文件`);
  }
} catch (e) {
  console.log('❌ 無法訪問備份目錄');
}

console.log('\n💡 下一步建議:');
console.log('1. 登入 Render Dashboard');
console.log('2. 在環境變數設定中設置 DATABASE_URL');
console.log('3. 使用以下格式: mysql://user:password@host:port/database');
console.log('4. 如果密碼遺失,可登入 TiDB Cloud 控制台重新設定');
