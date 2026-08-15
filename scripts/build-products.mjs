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
const YAMADA_SRC = '/Users/agmini/Documents/yamada-kagaku-db/data/yamada-products-v2.json';

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
  laundry: '洗衣用品',
  living: '居家生活',
  healthcare: '美妝保養',
  storage: '收納用品',
  bath: '衛浴用品',
  life_stage: '銀髮親子',
  cleaning: '清潔用品',
  gift: '禮品包裝',
  stationery: '文具用品',
};

/**
 * 山田化學的商品已被併進百元批發資料，但 images 是空陣列、jan 是空字串。
 * 山田自己的資料集有圖片，且圖片檔名就是 JAN 條碼
 * （4965534356817.jpg），兩邊用品名可以 100% 對上。
 */
function buildYamadaIndex() {
  const list = JSON.parse(fs.readFileSync(YAMADA_SRC, 'utf-8'));
  const index = new Map();
  for (const p of list) {
    const jan = /\/(\d{8,14})\.(?:jpg|jpeg|png|webp)/i.exec(p.imageUrl ?? '')?.[1] ?? '';
    index.set(p.name.trim(), { imageUrl: p.imageUrl, jan });
  }
  return index;
}
const yamada = buildYamadaIndex();

/** 排除中國製（含「日本/中国」這類混合標示）；其餘產地一律保留 */
function isChinaMade(origin) {
  return typeof origin === 'string' && /中国|中國|china/i.test(origin);
}

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

// ---- 日本小商品：全部上架，排除中國製 ----
const kokubo = JSON.parse(fs.readFileSync(KOKUBO_SRC, 'utf-8'));
let skippedChina = 0;
let skippedNoImage = 0;
let filledFromYamada = 0;
const bucket = new Map();
for (const p of kokubo) {
  if (isChinaMade(p.origin)) { skippedChina++; continue; }

  // 山田商品在這份資料裡沒有圖與條碼，從山田資料集補上
  if (!p.images?.length) {
    const y = yamada.get(p.nameJa?.trim());
    if (!y?.imageUrl) { skippedNoImage++; continue; }
    p.images = [y.imageUrl];
    if (!p.jan && y.jan) p.jan = y.jan;
    filledFromYamada++;
  }
  const label = KOKUBO_CAT[p.category?.slug] ?? p.category?.label;
  if (!label) continue;
  const list = bucket.get(label) ?? [];
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
      origin: p.origin ?? '',
      status: 'available',
      imageUrl: p.images[0],
      images: p.images.slice(0, 4),
      sourceUrl: p.url,
    });
  }
}

// description 佔了整包 67%，但列表頁不顯示它。
// 拆成主檔（列表用，體積小）與詳情檔（商品頁再抓），
// 否則每個訪客一進站就要下載 4MB。
const details = {};
const list = out.map(({ description, spec, sourceUrl, images, ...rest }) => {
  if (description || sourceUrl || (images && images.length > 1)) {
    details[rest.id] = { description: description ?? '', sourceUrl, images };
  }
  return rest;
});

for (const dir of ['client/public', 'server/public', 'dist/public']) {
  const dest = path.join(root, dir);
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'products.json'), JSON.stringify(list));
  fs.writeFileSync(path.join(dest, 'product-details.json'), JSON.stringify(details));
}
const kb = (o) => Math.round(Buffer.byteLength(JSON.stringify(o)) / 1024);
console.log(`   products.json ${kb(list)} KB / product-details.json ${kb(details)} KB`);

const cats = [...new Set(out.map(p => p.category))];
console.log(`   排除中國製 ${skippedChina} 筆、仍無圖 ${skippedNoImage} 筆`);
console.log(`   從山田資料集補上圖片與 JAN: ${filledFromYamada} 筆`);
console.log(`✅ 共 ${out.length} 筆（介護 ${careCount} / 小商品 ${out.length - careCount}）`);
console.log(`   分類 ${cats.length} 個: ${cats.join('、')}`);
console.log(`   全部有圖: ${out.every(p => p.imageUrl)}`);
