import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const OFFICIAL_PRODUCTS_URL = "https://www.yamadakagaku.co.jp/products/";
const quotePath = process.argv[2];
const outputPath = path.resolve(process.cwd(), "client/public/ag-products.json");

if (!quotePath) {
  console.error("Usage: node scripts/build-ag-catalog.mjs <quotation.xlsx>");
  process.exit(1);
}

function decodeHtml(value = "") {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function valueOrNull(value) {
  const normalized = decodeHtml(String(value ?? "")).trim();
  return normalized && normalized !== "-" ? normalized : null;
}

function normalizeQuoteRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim().replace(/\s+/g, " "), value]),
  );
}

function normalizeCountry(value) {
  const normalized = valueOrNull(value)?.normalize("NFKC");
  if (normalized?.toUpperCase() === "J") return "日本";
  return normalized || null;
}

function readActiveQuotationProducts(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets.QUOTE || workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("找不到 QUOTE 工作表");

  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
  return rawRows
    .map(normalizeQuoteRow)
    .map((row) => {
      const barcode = String(row.BARCODE ?? "").replace(/\D/g, "");
      const wholesaleFobJpy = Number(row["F.O.B."]);
      return {
        barcode,
        catalog: valueOrNull(row.CATALOG),
        nameJa: valueOrNull(row["商品名"] || row.DESCRIPTION),
        nameEn: valueOrNull(row.DESCRIPTION),
        countryOrigin: normalizeCountry(row["COUNTRY OF ORIGIN"]),
        hasWholesalePrice: Number.isFinite(wholesaleFobJpy) && wholesaleFobJpy > 0,
      };
    })
    .filter((row) => /^\d{8,14}$/.test(row.barcode) && row.nameJa && row.hasWholesalePrice);
}

function parseOfficialProducts(html) {
  const products = [];
  const productPattern = /<div class="product_item ([^"]*)"[^>]*>[\s\S]*?<a [\s\S]*?class="product_card"([\s\S]*?)>/g;

  for (const match of html.matchAll(productPattern)) {
    const attributes = {};
    for (const attribute of match[2].matchAll(/data-([a-z0-9]+)="([^"]*)"/g)) {
      attributes[attribute[1]] = decodeHtml(attribute[2]);
    }

    if (!/^\d{8,14}$/.test(attributes.jan || "")) continue;
    products.push({ ...attributes, categories: match[1].split(/\s+/).filter(Boolean) });
  }

  return products;
}

const quoteProducts = readActiveQuotationProducts(path.resolve(quotePath));
const quoteByBarcode = new Map(quoteProducts.map((product) => [product.barcode, product]));
const response = await fetch(OFFICIAL_PRODUCTS_URL);
if (!response.ok) throw new Error(`山田化學官網讀取失敗：HTTP ${response.status}`);
const officialProducts = parseOfficialProducts(await response.text());

if (officialProducts.length < 500) {
  throw new Error(`官網商品解析數量異常：只讀到 ${officialProducts.length} 筆`);
}

// 官網用「-」表示標準價商品；數字價格（200～700 日圓）不可套用本站 NT$22 定價。
const standardPriceProducts = officialProducts.filter((product) => product.price === "-");
const standardBarcodes = new Set(standardPriceProducts.map((product) => product.jan));

const publicProducts = standardPriceProducts.map((official, index) => {
  const quote = quoteByBarcode.get(official.jan);
  const images = [official.img1, official.img2, official.img3].map(valueOrNull).filter(Boolean);
  return {
    id: `yamada-${official.jan}`,
    catalog: quote?.catalog || valueOrNull(official.num),
    barcode: official.jan,
    nameJa: valueOrNull(official.name),
    nameEn: quote?.nameEn || null,
    countryOrigin: valueOrNull(official.country) || quote?.countryOrigin || null,
    retailPriceTwd: 22,
    imageUrl: images[0] || null,
    images,
    size: valueOrNull(official.size),
    capacity: valueOrNull(official.capacity),
    material: valueOrNull(official.material),
    assortment: valueOrNull(official.assort),
    sortOrder: index + 1,
    status: "available",
    officialMatched: true,
    officialProductNumber: valueOrNull(official.num),
    officialQuantity: valueOrNull(official.quantity),
    officialPackageSize: valueOrNull(official.pkgsize),
    officialCaseSize: valueOrNull(official.casesize),
    officialSourceUrl: OFFICIAL_PRODUCTS_URL,
  };
});

for (const quote of quoteProducts) {
  if (standardBarcodes.has(quote.barcode)) continue;
  publicProducts.push({
    id: `yamada-${quote.barcode}`,
    catalog: quote.catalog,
    barcode: quote.barcode,
    nameJa: quote.nameJa,
    nameEn: quote.nameEn,
    countryOrigin: quote.countryOrigin,
    retailPriceTwd: 22,
    imageUrl: null,
    images: [],
    size: null,
    capacity: null,
    material: null,
    assortment: null,
    sortOrder: publicProducts.length + 1,
    status: "available",
    officialMatched: false,
    officialProductNumber: null,
    officialQuantity: null,
    officialPackageSize: null,
    officialCaseSize: null,
    officialSourceUrl: OFFICIAL_PRODUCTS_URL,
  });
}

fs.writeFileSync(outputPath, `${JSON.stringify(publicProducts, null, 2)}\n`);

console.log(`官網商品：${officialProducts.length} 筆`);
console.log(`官網標準價：${standardPriceProducts.length} 筆`);
console.log(`報價單有效商品：${quoteProducts.length} 筆`);
console.log(`前台輸出：${publicProducts.length} 筆`);
