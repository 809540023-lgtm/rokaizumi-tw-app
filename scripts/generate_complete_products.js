const fs = require('fs');
const path = require('path');

// 日本小商品數據（帶圖片）
const japaneseProducts = [
  { id: 1, name: "日本製收納盒套裝", nameJa: "日本製収納ボックスセット", category: "日用百貨", price: 3500, priceJpy: 1167, description: "多層收納設計", imageUrl: "https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=收納盒" },
  { id: 2, name: "日式便當盒", nameJa: "日式弁当箱", category: "廚房用品", price: 2800, priceJpy: 933, description: "環保材料", imageUrl: "https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=便當盒" },
  { id: 3, name: "無印風文具套裝", nameJa: "無印調文房具セット", category: "文具用品", price: 1500, priceJpy: 500, description: "簡約設計", imageUrl: "https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=文具" },
  { id: 4, name: "廚房清潔海綿組", nameJa: "キッチン洗浄スポンジ", category: "清潔用品", price: 890, priceJpy: 297, description: "耐用持久", imageUrl: "https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=海綿" },
  { id: 5, name: "抽屜分隔板組", nameJa: "引出し仕切り板", category: "收納用品", price: 1200, priceJpy: 400, description: "多規格", imageUrl: "https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=分隔板" },
  { id: 6, name: "日本面膜套裝", nameJa: "日本フェイスマスク", category: "美妝保養", price: 4500, priceJpy: 1500, description: "保濕專業", imageUrl: "https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=面膜" },
  { id: 7, name: "日本零食禮盒", nameJa: "日本スナック", category: "食品零食", price: 6800, priceJpy: 2267, description: "精選組合", imageUrl: "https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=零食" },
  { id: 8, name: "卡通造型玩具", nameJa: "キャラクターおもちゃ", category: "玩具雜貨", price: 1800, priceJpy: 600, description: "兒童玩具", imageUrl: "https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=玩具" }
];

// 讀取現有介護用品
const careProductsPath = path.resolve(__dirname, '../client/public/products.json');
const careProducts = JSON.parse(fs.readFileSync(careProductsPath, 'utf-8'));

// 合併兩類產品，日本小商品 ID 1-100，介護用品 ID 200-419
const careProductsWithId = careProducts.map((p, i) => ({
  ...p,
  id: 200 + i
}));

const allProducts = [...japaneseProducts, ...careProductsWithId];

// 寫入到三個位置
const outputPaths = [
  path.resolve(__dirname, '../client/public/products.json'),
  path.resolve(__dirname, '../server/public/products.json'),
  path.resolve(__dirname, '../dist/public/products.json')
];

for (const outputPath of outputPaths) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2));
  console.log(`✅ 已寫入: ${outputPath} (${allProducts.length} 個產品)`);
}
