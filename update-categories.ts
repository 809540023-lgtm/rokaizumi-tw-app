import { drizzle } from 'drizzle-orm/mysql2';
import { categories } from './drizzle/schema';

const db = drizzle(process.env.DATABASE_URL!);

const newCategories = [
  // 日本百元商品分類
  { name: '日用百貨', description: '各類日常生活用品' },
  { name: '廚房用品', description: '廚房工具、餐具、保鮮用品' },
  { name: '文具用品', description: '辦公文具、學習用品' },
  { name: '清潔用品', description: '清潔劑、清潔工具' },
  { name: '收納用品', description: '收納盒、整理箱' },
  { name: '美妝保養', description: '化妝品、保養品' },
  { name: '食品零食', description: '日本零食、調味料' },
  { name: '玩具雜貨', description: '玩具、裝飾品' },
  
  // 老人看護器材分類
  { name: '行動輔助', description: '拐杖、助行器、輪椅' },
  { name: '衛浴安全', description: '浴室扶手、防滑墊、沐浴椅' },
  { name: '健康監測', description: '血壓計、血糖機、體溫計' },
  { name: '護理用品', description: '成人紙尿褲、護理墊、防褥瘡墊' },
  { name: '復健器材', description: '復健訓練器材、運動輔具' },
  { name: '生活輔具', description: '起身輔助器、穿襪器、取物夾' },
  { name: '床邊照護', description: '護理床、床邊扶手、床上桌' },
  { name: '安全監控', description: '緊急呼叫器、監控設備' },
];

async function updateCategories() {
  try {
    console.log('開始更新產品分類...');
    
    // 清空現有分類
    await db.delete(categories);
    console.log('✓ 已清空舊分類');
    
    // 插入新分類
    for (const category of newCategories) {
      await db.insert(categories).values(category);
      console.log(`✓ 已添加分類：${category.name}`);
    }
    
    console.log(`\n✅ 成功更新 ${newCategories.length} 個產品分類！`);
    process.exit(0);
  } catch (error) {
    console.error('❌ 更新分類時發生錯誤：', error);
    process.exit(1);
  }
}

updateCategories();
