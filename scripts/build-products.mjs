/**
 * 從原始抓取資料重建 products.json
 *
 * 介護用品：scrio.co.jp（220 筆，對應首頁文案「220 種精選輔具」）
 * 日本小商品：kokubo.co.jp（取每個分類的代表商品）
 *
 * 兩份來源都帶真實圖片網址，先前 products.json 的 imageUrl 全是空的，
 * 以及已停止服務的 via.placeholder.com。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const CARE_SRC = '/Volumes/ag/已完成專案/日本公司/Kimi_Agent_Deployment_v11/data/products.json';
const KOKUBO_SRC = '/Volumes/ag/百元批發/data/products.json';

// 日文分類 -> 站上使用的中文分類名
const CARE_CAT = {
  '杖(つえ・ステッキ)': '拐杖',
  '歩行器・移動補助': '助行器',
  '介護靴・ケアシューズ': '介護鞋',
  '車椅子・移乗支援': '輪椅移位',
  '入浴・お風呂用品': '入浴用品',
  'おトイレ・排せつ': '如廁照護',
  '大人用おむつ用品': '成人紙尿褲',
  '介護ベッド・寝具': '介護床寢具',
  '床ずれ(褥瘡)対策': '防褥瘡',
  '手すり': '安全扶手',
  '介護用食器・エプロン': '餐具圍兜',
};

const KOKUBO_CAT = {
  kitchen: '廚房用品',
  cleaning: '清潔用品',
  storage: '收納用品',
  stationery: '文具用品',
  bath: '衛浴用品',
  laundry: '洗衣用品',
  beauty: '美妝保養',
  interior: '居家生活',
  outdoor: '戶外用品',
  sanitary: '衛生用品',
};

const out = [];
let id = 1;

// ---- 介護用品 ----
const care = JSON.parse(fs.readFileSync(CARE_SRC, 'utf-8'));
for (const p of care) {
  out.push({
    id: id++,
    code: p.product_code,
    name: p.name,
    nameJa: p.name,
    category: CARE_CAT[p.category] ?? p.category,
    categoryJa: p.category,
    price: p.price_jpy,
    priceJpy: p.original_price_jpy,
    description: p.description || '',
    specifications: '',
    status: p.in_stock ? 'available' : 'sold',
    imageUrl: p.image_url,
    images: p.image_url ? [p.image_url] : [],
    sourceUrl: p.source_url,
  });
}
const careCount = out.length;

// ---- 日本小商品：每個分類取前 N 筆，保持頁面份量合理 ----
const PER_CAT = 12;
const kokubo = JSON.parse(fs.readFileSync(KOKUBO_SRC, 'utf-8'));
const bucket = new Map();
for (const p of kokubo) {
  const slug = p.category?.slug;
  const label = KOKUBO_CAT[slug];
  if (!label || !p.images?.length) continue;
  const list = bucket.get(label) ?? [];
  if (list.length >= PER_CAT) continue;
  list.push(p);
  bucket.set(label, list);
}
for (const [label, list] of bucket) {
  for (const p of list) {
    out.push({
      id: id++,
      code: p.code,
      jan: p.jan,
      name: p.nameCh || p.nameJa,
      nameJa: p.nameJa,
      nameEn: p.nameEn,
      category: label,
      categoryJa: p.category?.label ?? '',
      price: p.priceJpy,
      priceJpy: p.priceJpy,
      description: p.desc || '',
      specifications: p.casePack ? `入數 ${p.casePack}` : '',
      status: 'available',
      imageUrl: p.images[0],
      images: p.images.slice(0, 4),
      sourceUrl: p.url,
    });
  }
}

for (const dir of ['client/public', 'server/public', 'dist/public']) {
  const dest = path.join(root, dir);
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'products.json'), JSON.stringify(out, null, 2));
}

const cats = [...new Set(out.map(p => p.category))];
console.log(`✅ 共 ${out.length} 筆（介護 ${careCount} / 小商品 ${out.length - careCount}）`);
console.log(`   分類 ${cats.length} 個: ${cats.join('、')}`);
console.log(`   全部有圖: ${out.every(p => p.imageUrl)}`);
