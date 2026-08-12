import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { categories } from './drizzle/schema.js';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const initialCategories = [
  { name: '雞肉', description: '各類雞肉產品' },
  { name: '豬肉', description: '各類豬肉產品' },
  { name: '牛肉', description: '各類牛肉產品' },
  { name: '魚類', description: '各類魚類產品' },
  { name: '日本器材', description: '日本進口餐飲器材' },
  { name: '日本日用品', description: '日本進口日用品' },
  { name: '日本乾貨', description: '日本進口乾貨' },
  { name: '烹飪/加熱設備', description: '烹飪和加熱相關設備' },
  { name: '製冷/冷凍設備', description: '製冷和冷凍相關設備' },
  { name: '食物調理/加工設備', description: '食物調理和加工設備' },
  { name: '清洗/衛生設備', description: '清洗和衛生相關設備' },
  { name: '餐飲家具/陳列', description: '餐飲家具和陳列設備' },
  { name: '餐具/器皿', description: '各類餐具和器皿' },
  { name: '飲品/咖啡設備', description: '飲品和咖啡相關設備' },
  { name: '其他/雜項設備', description: '其他雜項設備' },
  { name: '手搖飲料店全套設備', description: '手搖飲料店全套設備' },
  { name: '加盟早餐店全套設備', description: '加盟早餐店全套設備' },
];

console.log('開始初始化分類資料...');

for (const category of initialCategories) {
  try {
    await db.insert(categories).values(category).onDuplicateKeyUpdate({ set: { name: category.name } });
    console.log(`✓ 已添加分類: ${category.name}`);
  } catch (error) {
    console.log(`⚠ 分類已存在: ${category.name}`);
  }
}

console.log('分類資料初始化完成！');
await connection.end();
