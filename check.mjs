import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL)

const roles = await sql`SELECT * FROM roles`
console.log('=== ROLES ===')
console.table(roles)

const users = await sql`SELECT users_id, role_id, first_name, last_name, phone, gender, status FROM users`
console.log('=== USERS ===')
console.table(users)

const patients = await sql`SELECT * FROM patients`
console.log('=== PATIENTS ===')
console.table(patients)

process.exit()