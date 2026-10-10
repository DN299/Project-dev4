import postgres from 'postgres'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('ไม่พบ DATABASE_URL')
}

const sql = postgres(connectionString, {
  ssl: 'require',
  connect_timeout: 10,
})

try {
  const result = await sql`
    select current_database(), current_user, now()
  `

  console.log('เชื่อม Supabase สำเร็จ')
  console.log(result)
} catch (error) {
  console.error('เชื่อม Supabase ไม่สำเร็จ')
  console.error(error)
} finally {
  await sql.end()
}