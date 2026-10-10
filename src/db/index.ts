import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("ไม่พบ DATABASE_URL ในไฟล์ .env");
}

// เก็บ client ไว้บน globalThis ตอน dev เพื่อไม่ให้ hot-reload สร้าง connection pool ใหม่ทุกครั้งที่แก้ไฟล์
// (ถ้าไม่ทำแบบนี้ connection จะรั่วสะสมจนชน connection limit ของ Supabase pooler)
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    ssl: "require",
    // Supabase session pooler จำกัด 15 connection ต่อโปรเจกต์ — ใช้น้อย ๆ และคืน connection ที่ว่างเกิน 20 วินาที
    max: 5,
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });