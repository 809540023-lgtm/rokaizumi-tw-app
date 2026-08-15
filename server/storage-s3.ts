/**
 * S3 儲存後端
 *
 * 原本的 storage.ts 走 Manus 平台的儲存代理，需要 BUILT_IN_FORGE_API_URL /
 * BUILT_IN_FORGE_API_KEY。搬到 Render 之後這兩個變數沒有設定，
 * 上傳一律拋出 "Storage proxy credentials missing"，圖片其實從來沒存進去過。
 *
 * 這裡改用 S3。設定齊全時走 S3，否則沿用原本的代理，兩邊都不通才報錯——
 * 錯誤訊息會明講缺哪些變數，不要讓人再猜一次。
 */

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const REGION = process.env.S3_REGION ?? process.env.AWS_REGION ?? '';
const BUCKET = process.env.S3_BUCKET ?? '';
const ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID ?? '';
const SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY ?? '';
/** 走 CloudFront 或自訂網域時填這個，否則用 S3 預設網址 */
const PUBLIC_BASE = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');

export function isS3Configured(): boolean {
  return Boolean(REGION && BUCKET && ACCESS_KEY && SECRET_KEY);
}

/** 缺哪些變數，給出可直接照做的清單 */
export function missingS3Vars(): string[] {
  const missing: string[] = [];
  if (!REGION) missing.push('S3_REGION');
  if (!BUCKET) missing.push('S3_BUCKET');
  if (!ACCESS_KEY) missing.push('AWS_ACCESS_KEY_ID');
  if (!SECRET_KEY) missing.push('AWS_SECRET_ACCESS_KEY');
  return missing;
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: REGION,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
    });
  }
  return client;
}

function publicUrl(key: string): string {
  if (PUBLIC_BASE) return `${PUBLIC_BASE}/${key}`;
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

export async function s3Put(
  key: string,
  data: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream'
): Promise<{ key: string; url: string }> {
  const body = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);

  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      // 商品圖要能直接被 <img> 讀取
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return { key, url: publicUrl(key) };
}
