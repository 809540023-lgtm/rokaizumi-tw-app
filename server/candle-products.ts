import { Router } from "express";
import mysql from "mysql2/promise";
import { createHash } from "node:crypto";
import { sdk } from "./_core/sdk";

/**
 * 蠟燭站的商品目錄。原本 20 款寫死在 client/public/candles/app.js，
 * 後台無法上架或改價，所以改成資料庫為主、程式內的清單只當第一次啟動的種子。
 */
const router = Router();

let pool: mysql.Pool | undefined;
export function database() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const url = new URL(process.env.DATABASE_URL);
    const override = process.env.DATABASE_SSL;
    const internal = /^(localhost|127\.0\.0\.1|10\..*|192\.168\..*|172\.(1[6-9]|2\d|3[01])\..*)$/.test(url.hostname);
    pool = mysql.createPool({ uri: process.env.DATABASE_URL, ...(override === "false" || (!override && internal) ? {} : { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } }) });
  }
  return pool;
}

type SeedProduct = { id: number; name: string; nameTw: string; sku: string; sort: number };

// 順序沿用澳洲站目前的顯示順序。
const SEED: SeedProduct[] = [
  { id: 1, name: "Elephant", nameTw: "大象", sku: "RZ-C001", sort: 1 },
  { id: 2, name: "Golden Retriever Pair (2 dogs)", nameTw: "黃金獵犬雙狗組", sku: "RZ-C002", sort: 2 },
  { id: 20, name: "Christmas Snowman & Trees", nameTw: "聖誕雪人與樹", sku: "RZ-C026", sort: 3 },
  { id: 21, name: "Macaron Dessert Bowl", nameTw: "馬卡龍甜點碗", sku: "RZ-C021", sort: 4 },
  { id: 3, name: "Puppy in Egg", nameTw: "蛋殼小狗", sku: "RZ-C003", sort: 5 },
  { id: 5, name: "Iced Latte", nameTw: "冰拿鐵", sku: "RZ-C005", sort: 6 },
  { id: 7, name: "Strawberry Shake", nameTw: "草莓奶昔", sku: "RZ-C007", sort: 7 },
  { id: 8, name: "Cherry Shake", nameTw: "櫻桃奶昔", sku: "RZ-C008", sort: 8 },
  { id: 9, name: "Pineapple Juice", nameTw: "鳳梨果汁", sku: "RZ-C009", sort: 9 },
  { id: 10, name: "Passion Fruit Drink", nameTw: "百香果飲品", sku: "RZ-C010", sort: 10 },
  { id: 13, name: "Green Jelly", nameTw: "綠色果凍", sku: "RZ-C013", sort: 11 },
  { id: 14, name: "Blue Jelly", nameTw: "藍色果凍", sku: "RZ-C014", sort: 12 },
  { id: 15, name: "Grey & White Flowers", nameTw: "灰白花束", sku: "RZ-C015", sort: 13 },
  { id: 16, name: "Floral Tower 1", nameTw: "花朵塔 1", sku: "RZ-C016", sort: 14 },
  { id: 17, name: "Floral Tower 2", nameTw: "花朵塔 2", sku: "RZ-C017", sort: 15 },
  { id: 25, name: "Sleeping Bear & Chocolate", nameTw: "睡熊與巧克力", sku: "RZ-C025", sort: 16 },
  { id: 27, name: "Fruit & Flower Cake", nameTw: "水果花朵蛋糕", sku: "RZ-C027", sort: 17 },
  { id: 28, name: "Strawberry Cake", nameTw: "草莓蛋糕", sku: "RZ-C028", sort: 18 },
  { id: 29, name: "Knitted Mitten + Yarn Ball (1 of each)", nameTw: "針織手套", sku: "RZ-C029", sort: 19 },
  { id: 30, name: "Rose Ball (1 candle · random colour)", nameTw: "玫瑰花束球", sku: "RZ-C030", sort: 20 },
];

export type CandleProductRow = {
  id: number;
  name: string;
  nameTw: string;
  sku: string;
  lit: string;
  original: string;
  active: boolean;
  sortOrder: number;
};

export const DEFAULT_PRICES = { aud: 99, twd: 1499 };

export async function ensureCandleTables(db: mysql.Pool) {
  await db.query(`CREATE TABLE IF NOT EXISTS candle_products (
    id int NOT NULL PRIMARY KEY,
    name varchar(120) NOT NULL,
    name_tw varchar(120) NOT NULL DEFAULT '',
    sku varchar(40) NOT NULL DEFAULT '',
    lit varchar(500) NOT NULL DEFAULT '',
    original varchar(500) NOT NULL DEFAULT '',
    active tinyint(1) NOT NULL DEFAULT 1,
    sort_order int NOT NULL DEFAULT 0,
    created_at datetime NOT NULL,
    updated_at datetime NOT NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS candle_images (
    id char(64) NOT NULL PRIMARY KEY,
    mime varchar(64) NOT NULL,
    bytes longblob NOT NULL
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS candle_settings (
    k varchar(64) NOT NULL PRIMARY KEY,
    v varchar(255) NOT NULL
  )`);
  const placeholders = SEED.map(() => "(?,?,?,?,'','',1,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())").join(",");
  await db.query(
    `INSERT IGNORE INTO candle_products (id,name,name_tw,sku,lit,original,active,sort_order,created_at,updated_at) VALUES ${placeholders}`,
    SEED.flatMap(p => [p.id, p.name, p.nameTw, p.sku, p.sort])
  );
  await db.query(
    "INSERT IGNORE INTO candle_settings (k,v) VALUES ('au_price_aud','99'),('tw_price_twd','1499')"
  );
}

function toRow(row: mysql.RowDataPacket): CandleProductRow {
  return {
    id: Number(row.id),
    name: String(row.name ?? ""),
    nameTw: String(row.name_tw ?? ""),
    sku: String(row.sku ?? ""),
    lit: String(row.lit ?? ""),
    original: String(row.original ?? ""),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function listCandleProducts(db: mysql.Pool, includeInactive = false) {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT id,name,name_tw,sku,lit,original,active,sort_order FROM candle_products${
      includeInactive ? "" : " WHERE active=1"
    } ORDER BY sort_order, id`
  );
  return (rows ?? []).map(toRow);
}

/** 訂單驗證用：資料庫掛掉或還沒建表時回空集合，呼叫端會退回程式內的名單。 */
export async function activeCandleIds(db: mysql.Pool) {
  try {
    await ensureCandleTables(db);
    const products = await listCandleProducts(db);
    return new Set(products.map(p => p.id));
  } catch {
    return new Set<number>();
  }
}

export async function candlePrices(db: mysql.Pool) {
  try {
    await ensureCandleTables(db);
    const [rows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT k,v FROM candle_settings WHERE k IN ('au_price_aud','tw_price_twd')"
    );
    const map = new Map((rows ?? []).map(r => [String(r.k), Number(r.v)]));
    const aud = map.get("au_price_aud");
    const twd = map.get("tw_price_twd");
    return {
      aud: Number.isSafeInteger(aud) && aud! > 0 ? aud! : DEFAULT_PRICES.aud,
      twd: Number.isSafeInteger(twd) && twd! > 0 ? twd! : DEFAULT_PRICES.twd,
    };
  } catch {
    return { ...DEFAULT_PRICES };
  }
}

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function imageMime(bytes: Buffer) {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length > 12 && bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (bytes.length > 6 && bytes.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  return null;
}

function storeImage(bytes: Buffer) {
  if (!bytes.length) throw new CandleInputError("圖片是空的，請重新選擇");
  if (bytes.length > MAX_IMAGE_BYTES) throw new CandleInputError("圖片不得超過 3MB，請先壓縮再上傳");
  const mime = imageMime(bytes);
  if (!mime || !IMAGE_TYPES[mime]) throw new CandleInputError("只接受 JPG、PNG、WebP 或 GIF 圖片");
  const id = createHash("sha256").update(bytes).digest("hex");
  return { id, mime, url: `/api/candles/img/${id}.${IMAGE_TYPES[mime]}` };
}

export class CandleInputError extends Error {}

const text = (value: unknown, label: string, max: number, required = false) => {
  if (value === undefined || value === null) {
    if (required) throw new CandleInputError(`請輸入${label}`);
    return "";
  }
  if (typeof value !== "string") throw new CandleInputError(`${label}格式不正確`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new CandleInputError(`請輸入${label}`);
  if (trimmed.length > max) throw new CandleInputError(`${label}不得超過 ${max} 字`);
  return trimmed;
};

function integer(value: unknown, label: string, min: number, max: number) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw new CandleInputError(`${label}需為 ${min} 到 ${max} 之間的整數`);
  return n;
}

async function requireAdmin(req: any, res: any) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      res.status(403).json({ error: "需要管理員權限" });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: "請先以管理員帳號登入" });
    return false;
  }
}

function fail(res: any, error: unknown) {
  if (error instanceof CandleInputError) return res.status(400).json({ error: error.message });
  console.error("Candle product error", error);
  return res.status(500).json({ error: "系統忙碌，請稍後再試" });
}

// 前台：只回上架中的商品與目前售價。
router.get("/products", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const db = database();
  if (!db) return res.json({ products: [], prices: DEFAULT_PRICES });
  try {
    await ensureCandleTables(db);
    const [products, prices] = await Promise.all([listCandleProducts(db), candlePrices(db)]);
    res.json({
      products: products.map(p => ({ id: p.id, name: p.name, nameTw: p.nameTw, sku: p.sku, lit: p.lit, original: p.original })),
      prices,
    });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/img/:file", async (req, res) => {
  const id = String(req.params.file).replace(/\.[a-z]+$/i, "");
  if (!/^[a-f0-9]{64}$/.test(id)) return res.status(404).end();
  const db = database();
  if (!db) return res.status(404).end();
  try {
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT mime,bytes FROM candle_images WHERE id=?",
      [id]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).end();
    res.setHeader("Content-Type", row.mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(row.bytes);
  } catch {
    res.status(500).end();
  }
});

// 後台：全部商品（含已下架）。
router.get("/admin/products", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const db = database();
  if (!db) return res.status(503).json({ error: "資料庫尚未設定" });
  try {
    await ensureCandleTables(db);
    const [products, prices] = await Promise.all([listCandleProducts(db, true), candlePrices(db)]);
    res.json({ products, prices });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/admin/products", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const db = database();
  if (!db) return res.status(503).json({ error: "資料庫尚未設定" });
  try {
    await ensureCandleTables(db);
    const name = text(req.body?.name, "英文品名", 120, true);
    const nameTw = text(req.body?.nameTw, "中文品名", 120);
    const sku = text(req.body?.sku, "SKU", 40);
    const active = req.body?.active === undefined ? true : Boolean(req.body.active);
    const [maxRows] = await db.query<mysql.RowDataPacket[]>(
      "SELECT COALESCE(MAX(sort_order),0) AS m, COALESCE(MAX(id),0) AS id FROM candle_products"
    );
    const sortOrder = req.body?.sortOrder === undefined
      ? Number(maxRows?.[0]?.m ?? 0) + 1
      : integer(req.body.sortOrder, "排序", 0, 999999);
    const id = Number(maxRows?.[0]?.id ?? 0) + 1;
    await db.execute(
      "INSERT INTO candle_products (id,name,name_tw,sku,lit,original,active,sort_order,created_at,updated_at) VALUES (?,?,?,?,'','',?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())",
      [id, name, nameTw, sku || `RZ-C${String(id).padStart(3, "0")}`, active ? 1 : 0, sortOrder]
    );
    const products = await listCandleProducts(db, true);
    res.status(201).json({ product: products.find(p => p.id === id) });
  } catch (error) {
    fail(res, error);
  }
});

router.patch("/admin/products/:id", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const db = database();
  if (!db) return res.status(503).json({ error: "資料庫尚未設定" });
  try {
    await ensureCandleTables(db);
    const id = integer(req.params.id, "商品編號", 1, 999999);
    const body = req.body ?? {};
    const allowed = ["name", "nameTw", "sku", "active", "sortOrder"];
    if (!Object.keys(body).length || Object.keys(body).some(k => !allowed.includes(k)))
      throw new CandleInputError("只能修改品名、SKU、上架狀態與排序");
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id,name,name_tw,sku,active,sort_order FROM candle_products WHERE id=?",
      [id]
    );
    const row = rows?.[0];
    if (!row) return res.status(404).json({ error: "找不到商品" });
    const name = body.name === undefined ? row.name : text(body.name, "英文品名", 120, true);
    const nameTw = body.nameTw === undefined ? row.name_tw : text(body.nameTw, "中文品名", 120);
    const sku = body.sku === undefined ? row.sku : text(body.sku, "SKU", 40);
    const active = body.active === undefined ? Boolean(row.active) : Boolean(body.active);
    const sortOrder = body.sortOrder === undefined ? Number(row.sort_order) : integer(body.sortOrder, "排序", 0, 999999);
    await db.execute(
      "UPDATE candle_products SET name=?,name_tw=?,sku=?,active=?,sort_order=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
      [name, nameTw, sku, active ? 1 : 0, sortOrder, id]
    );
    const products = await listCandleProducts(db, true);
    res.json({ product: products.find(p => p.id === id) });
  } catch (error) {
    fail(res, error);
  }
});

router.delete("/admin/products/:id", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const db = database();
  if (!db) return res.status(503).json({ error: "資料庫尚未設定" });
  try {
    await ensureCandleTables(db);
    const id = integer(req.params.id, "商品編號", 1, 999999);
    const [result] = await db.execute<mysql.ResultSetHeader>(
      "DELETE FROM candle_products WHERE id=?",
      [id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "找不到商品" });
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/admin/products/:id/image", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const db = database();
  if (!db) return res.status(503).json({ error: "資料庫尚未設定" });
  try {
    await ensureCandleTables(db);
    const id = integer(req.params.id, "商品編號", 1, 999999);
    const data = req.body?.data;
    const match = typeof data === "string" ? /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(data) : null;
    if (!match) throw new CandleInputError("請選擇 JPG、PNG、WebP 或 GIF 圖片");
    const bytes = Buffer.from(match[2], "base64");
    const { id: hash, mime, url } = storeImage(bytes);
    const [rows] = await db.execute<mysql.RowDataPacket[]>(
      "SELECT id FROM candle_products WHERE id=?",
      [id]
    );
    if (!rows?.[0]) return res.status(404).json({ error: "找不到商品" });
    await db.query("INSERT IGNORE INTO candle_images (id,mime,bytes) VALUES (?,?,?)", [hash, mime, bytes]);
    // 上傳的照片同時當點燃情境圖與原圖，前台就不再找 images/lit-NN.jpeg。
    await db.execute(
      "UPDATE candle_products SET lit=?,original=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
      [url, url, id]
    );
    res.json({ image: url });
  } catch (error) {
    fail(res, error);
  }
});

router.put("/admin/settings", async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const db = database();
  if (!db) return res.status(503).json({ error: "資料庫尚未設定" });
  try {
    await ensureCandleTables(db);
    const aud = integer(req.body?.aud, "澳洲售價", 1, 100000);
    const twd = integer(req.body?.twd, "台灣售價", 1, 1000000);
    await db.execute(
      "INSERT INTO candle_settings (k,v) VALUES ('au_price_aud',?),('tw_price_twd',?) ON DUPLICATE KEY UPDATE v=VALUES(v)",
      [String(aud), String(twd)]
    );
    res.json({ prices: { aud, twd } });
  } catch (error) {
    fail(res, error);
  }
});

export default router;
