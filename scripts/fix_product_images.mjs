import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 可靠的圖片 URL 生成器 (使用 DiceBear avatars 或其他可靠服務)
function generateImageUrl(productId, productName) {
  // 使用 UI Avatars 服務（免費且可靠）
  const encoded = encodeURIComponent(productName.substring(0, 2));
  return `https://ui-avatars.com/api/?name=${encoded}&background=FFE5CC&color=FF6B35&size=400&bold=true&length=2`;
}

// 讀取產品數據
const productsPath = path.resolve(__dirname, '../client/public/products.json');
let products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));

// 修復所有沒有有效 imageUrl 的產品
products = products.map(product => {
  if (!product.imageUrl || product.imageUrl.includes('placeholder')) {
    return {
      ...product,
      imageUrl: generateImageUrl(product.id, product.name)
    };
  }
  return product;
});

// 寫入三個位置
const outputPaths = [
  path.resolve(__dirname, '../client/public/products.json'),
  path.resolve(__dirname, '../server/public/products.json'),
];

for (const outputPath of outputPaths) {
  fs.writeFileSync(outputPath, JSON.stringify(products, null, 2));
  console.log(`✅ 已修復圖片 URL: ${outputPath}`);
}

console.log(`\n📊 已修復 ${products.length} 個產品的圖片`);
