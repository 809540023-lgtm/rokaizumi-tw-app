/**
 * 恢復舊產品數據腳本
 * 從備份恢復介護用品和其他產品到資料庫
 */

import mysql from 'mysql2/promise';
import fs from 'fs';

const backupFile = './client/src/data/old_products_backup.json';

async function restoreProducts() {
  try {
    console.log('📚 === 恢復產品數據 ===\n');
    
    // 檢查備份文件
    if (!fs.existsSync(backupFile)) {
      console.log('❌ 找不到備份文件:', backupFile);
      return;
    }
    
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
    console.log(`✓ 載入備份: ${backup.total_products} 項產品`);
    
    // 獲取數據庫連接
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.log('❌ DATABASE_URL 未設定，無法連接數據庫');
      console.log('\n💡 請在 Render Dashboard 設定 DATABASE_URL 環境變數');
      return;
    }
    
    const pool = mysql.createPool(dbUrl);
    const conn = await pool.getConnection();
    console.log('✓ 數據庫連接成功\n');
    
    // 統計現有產品
    const [existing] = await conn.execute('SELECT COUNT(*) as count FROM products');
    console.log(`📊 現有產品: ${existing[0].count} 項`);
    
    // 恢復備份產品
    let inserted = 0;
    for (const product of backup.products) {
      try {
        await conn.execute(
          'INSERT INTO products (name, description, specifications, price, categoryId, status) VALUES (?, ?, ?, ?, ?, ?)',
          [
            product.name,
            product.description,
            product.specifications,
            product.price_twd,
            product.categoryId,
            product.status
          ]
        );
        inserted++;
      } catch (err) {
        if (!err.message.includes('Duplicate')) {
          console.error(`❌ 插入失敗 [${product.name}]:`, err.message);
        }
      }
    }
    
    console.log(`✅ 恢復完成: 插入 ${inserted} 項新產品`);
    
    // 驗證
    const [final] = await conn.execute('SELECT COUNT(*) as count FROM products');
    console.log(`📊 最終產品數: ${final[0].count} 項`);
    
    await conn.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    process.exit(1);
  }
}

restoreProducts();
