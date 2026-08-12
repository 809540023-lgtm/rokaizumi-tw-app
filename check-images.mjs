import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./drizzle/schema.ts";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection, { schema, mode: "default" });

const products = await db.select({
  id: schema.products.id,
  name: schema.products.name,
  imageUrl: schema.products.imageUrl
}).from(schema.products).limit(15);

console.log("Products with imageUrl:");
products.forEach(p => {
  console.log(`ID: ${p.id}, Name: ${p.name.substring(0, 30)}, ImageUrl: ${p.imageUrl || 'NULL'}`);
});

await connection.end();
