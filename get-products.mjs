import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./drizzle/schema.ts";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: "default" });

// 獲取前 5 個產品
const products = await db.select({
  id: schema.products.id,
  name: schema.products.name,
  imageUrl: schema.products.imageUrl
}).from(schema.products).limit(5);

console.log("Products to update:");
products.forEach(p => {
  console.log(`ID: ${p.id} | Name: ${p.name} | Current Image: ${p.imageUrl ? 'placeholder' : 'none'}`);
});

await connection.end();
