// ใช้รันไฟล์ migration ที่เขียนเอง (Backend/drizzle/000x_*.sql) กับฐานข้อมูลใน .env
// วิธีใช้: node apply-sql.mjs Backend/drizzle/0007_device_live.sql
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import 'dotenv/config'

const file = process.argv[2]
if (!file) throw new Error('ต้องระบุไฟล์ .sql เช่น node apply-sql.mjs Backend/drizzle/0007_device_live.sql')
if (!process.env.DATABASE_URL) throw new Error('ไม่พบ DATABASE_URL')

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10 })
const statements = readFileSync(file, 'utf8').split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)

try {
  for (const stmt of statements) await sql.unsafe(stmt)
  console.log(`รัน ${file} สำเร็จ (${statements.length} คำสั่ง)`)
} catch (error) {
  console.error(`รัน ${file} ไม่สำเร็จ`)
  console.error(error)
  process.exitCode = 1
} finally {
  await sql.end()
}
