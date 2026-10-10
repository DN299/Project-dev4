import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL)

async function seed() {
  console.log('🌱 Seeding database...')

  // 1. สร้าง Roles
  await sql`INSERT INTO roles (role_id, role_name) VALUES
    ('R001', 'ผู้ป่วย'),
    ('R002', 'นักกิจกรรมบำบัด'),
    ('R003', 'เจ้าหน้าที่เวชระเบียน')
  ON CONFLICT DO NOTHING`
  console.log('✅ Roles created')

  // 2. สร้าง Users
  await sql`INSERT INTO users (users_id, role_id, username, password, first_name, last_name, phone, email, gender, birth_date) VALUES
    ('U001', 'R001', 'somchai', '1234', 'สมชาย', 'ใจดี', '081-234-5678', 'somchai@test.com', 'ชาย', '1960-05-15'),
    ('U002', 'R001', 'wipawee', '1234', 'วิภาวี', 'สุขสม', '082-345-6789', 'wipawee@test.com', 'หญิง', '1958-08-20'),
    ('U003', 'R001', 'prasert', '1234', 'ประเสริฐ', 'คงใจ', '083-456-7890', 'prasert@test.com', 'ชาย', '1955-12-10'),
    ('U004', 'R002', 'sittichai', '1234', 'สิทธิ์ชัย', 'หมอดี', '084-567-8901', 'sittichai@test.com', 'ชาย', '1985-03-25'),
    ('U005', 'R003', 'admin1', '1234', 'รุสนา', 'หมานสะยะ', '085-678-9012', 'admin@test.com', 'หญิง', '1990-07-01')
  ON CONFLICT DO NOTHING`
  console.log('✅ Users created')

  // 3. สร้าง Patients (ข้อมูลประจำตัว) + เคสการรักษา (ข้อมูลทางคลินิกอยู่ใน treatment_cases)
  await sql`INSERT INTO patients (patient_id, users_id, address) VALUES
    ('P001', 'U001', '123 ถ.สุขุมวิท กรุงเทพ'),
    ('P002', 'U002', '456 ถ.พหลโยธิน กรุงเทพ'),
    ('P003', 'U003', '789 ถ.รัชดา กรุงเทพ')
  ON CONFLICT DO NOTHING`
  await sql`INSERT INTO treatment_cases (case_id, patient_id, primary_ot_id, status, current_stage, start_stage) VALUES
    ('CASE-P001', 'P001', NULL, 'PENDING_ASSESSMENT', NULL, NULL),
    ('CASE-P002', 'P002', NULL, 'PENDING_ASSESSMENT', NULL, NULL),
    ('CASE-P003', 'P003', NULL, 'PENDING_ASSESSMENT', NULL, NULL)
  ON CONFLICT DO NOTHING`
  console.log('✅ Patients created')

  console.log('🎉 Seed complete!')
  process.exit(0)
}

seed().catch(e => { console.error(e); process.exit(1) })