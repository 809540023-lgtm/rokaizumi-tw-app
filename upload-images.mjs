import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";
import fs from "fs";

// S3 上傳函數 - 使用正確的 API 格式
async function uploadToS3(filePath, fileName, contentType) {
  const baseUrl = process.env.BUILT_IN_FORGE_API_URL.replace(/\/+$/, "");
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: contentType });
  
  const formData = new FormData();
  formData.append("file", blob, fileName);
  
  const relKey = `products/${Date.now()}-${fileName}`;
  const uploadUrl = new URL(`${baseUrl}/v1/storage/upload`);
  uploadUrl.searchParams.set("path", relKey);
  
  console.log("Upload URL:", uploadUrl.toString());
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`S3 upload failed (${response.status}): ${errorText}`);
  }
  
  const result = await response.json();
  return result.url;
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection, { schema, mode: "default" });

  // 上傳產品 1 的圖片
  console.log("Uploading image for product 1 (日本製收納盒套裝)...");
  const url1 = await uploadToS3(
    "/home/ubuntu/rokaizumi_catering_equipment/product1.jpeg",
    "storage-box-set.jpeg",
    "image/jpeg"
  );
  console.log("Product 1 image URL:", url1);

  // 更新資料庫
  await db.update(schema.products)
    .set({ imageUrl: url1 })
    .where(eq(schema.products.id, 1));
  console.log("Product 1 database updated!");

  // 上傳產品 2 的圖片
  console.log("\nUploading image for product 2 (日式便當盒)...");
  const url2 = await uploadToS3(
    "/home/ubuntu/rokaizumi_catering_equipment/product2.jpg",
    "bento-box.jpg",
    "image/jpeg"
  );
  console.log("Product 2 image URL:", url2);

  // 更新資料庫
  await db.update(schema.products)
    .set({ imageUrl: url2 })
    .where(eq(schema.products.id, 2));
  console.log("Product 2 database updated!");

  console.log("\n✅ Both products updated successfully!");
  
  await connection.end();
}

main().catch(console.error);
