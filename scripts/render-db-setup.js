#!/usr/bin/env node

/**
 * Render 資料庫自動設置腳本
 * 嘗試自動檢測和配置 DATABASE_URL
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Render 資料庫自動設置\n');

// 1. 檢查現有環境變數
console.log('1️⃣ 檢查環境變數...');
const dbUrl = process.env.DATABASE_URL;
const renderDbConn = process.env.DATABASE_CONNECTION;
const renderMysqlUrl = process.env.DATABASE_URL_MYSQL;

if (dbUrl) {
  console.log('✅ DATABASE_URL 已設置');
  console.log('   ' + dbUrl.replace(/:[^@]+@/, ':***@'));
  process.exit(0);
}

if (renderDbConn) {
  process.env.DATABASE_URL = renderDbConn;
  console.log('✅ 使用 DATABASE_CONNECTION');
  process.exit(0);
}

// 2. 檢查 Render MySQL 資料庫環境變數
console.log('2️⃣ 檢查 Render 資料庫變數...');
const renderDbHost = process.env.RENDER_DATABASE_HOST;
const renderDbName = process.env.RENDER_DATABASE_NAME;
const renderDbUser = process.env.RENDER_DATABASE_USER;
const renderDbPassword = process.env.RENDER_DATABASE_PASSWORD;

if (renderDbHost && renderDbName && renderDbUser && renderDbPassword) {
  const url = `mysql://${renderDbUser}:${renderDbPassword}@${renderDbHost}:3306/${renderDbName}`;
  process.env.DATABASE_URL = url;
  console.log('✅ 使用 Render MySQL 變數');
  console.log('   組成 DATABASE_URL');

  // 保存到 .env.render
  fs.writeFileSync('.env.render', `DATABASE_URL=${url}\n`, { flag: 'a' });
  process.exit(0);
}

// 3. 嘗試使用已知的 TiDB Cloud 參數
console.log('3️⃣ 嘗試 TiDB Cloud 備用參數...');
if (process.env.TIDB_PASSWORD) {
  const url = `mysql://3FVGt3RqCkiFaDE.0fde5e63513d:${process.env.TIDB_PASSWORD}@gateway02.us-east-1.prod.aws.tidbcloud.com:4000/bMn2Gb7rjKtySEiV2r5RyX`;
  process.env.DATABASE_URL = url;
  console.log('✅ 使用 TIDB_PASSWORD 變數');
  process.exit(0);
}

// 4. 最後手段：嘗試連接到本地或默認資料庫
console.log('4️⃣ 檢查備用連接方式...');
console.log('❌ 無法自動配置 DATABASE_URL');
console.log('\n💡 必需的環境變數:');
console.log('   方式 1: DATABASE_URL (直接)');
console.log('   方式 2: RENDER_DATABASE_* (Render MySQL)');
console.log('   方式 3: TIDB_PASSWORD (TiDB Cloud)');
console.log('\n📋 TiDB Cloud 已知參數:');
console.log('   Host: gateway02.us-east-1.prod.aws.tidbcloud.com:4000');
console.log('   User: 3FVGt3RqCkiFaDE.0fde5e63513d');
console.log('   Database: bMn2Gb7rjKtySEiV2r5RyX');

process.exit(1);
