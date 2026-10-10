import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL, { max: 1 })

// โปรแกรมฝึกกลาง (SYSTEM) แยกตามระยะอาการของโรค — การสร้างโปรแกรมเป็นสิทธิของนักกิจกรรมบำบัดเท่านั้น
// จึงตั้ง created_by เป็นนักกิจกรรมบำบัดจริงในระบบ (U004 · OT001) ไม่ใช่เจ้าหน้าที่เวชระเบียน
// ให้นักกายภาพทุกคนเห็นและเลือกใช้ได้ทันทีจากหน้า "คลังโปรแกรมฝึก" โดยไม่ต้องสร้างเองทุกครั้ง
async function seed() {
  console.log('🌱 Seeding system programs...')

  await sql`INSERT INTO programs
    (program_id, program_name, description, program_type, target_stage, session_per_day, created_by, duration_sec, status)
  VALUES
    ('PRGSYS001', 'กระตุ้นกล้ามเนื้อระยะแรก',
     'เคลื่อนไหวช้า เบา และควบคุมได้ตลอดช่วง เน้นกระตุ้นการรับรู้ตำแหน่งข้อต่อโดยไม่ฝืนแรงต้าน ทำจำนวนครั้งน้อยแต่สม่ำเสมอเพื่อป้องกันข้อต่อยึดติด',
     'SYSTEM', 'EARLY', 2, 'U004', 900, 'ACTIVE'),

    ('PRGSYS002', 'คลายเกร็งและยืดเหยียดระยะเกร็ง',
     'ยืดเหยียดค้างไว้เป็นจังหวะช้าและสม่ำเสมอ หลีกเลี่ยงการเคลื่อนไหวเร็วหรือกระตุกที่อาจกระตุ้น spastic reflex ทำต่อเนื่องโดยไม่เร่งความเร็ว',
     'SYSTEM', 'MIDDLE', 2, 'U004', 1200, 'ACTIVE'),

    ('PRGSYS003', 'ฟื้นฟูเน้นความสม่ำเสมอระยะฟื้นตัว',
     'เน้นความสม่ำเสมอและความคงที่ของจังหวะการเคลื่อนไหวในทุกครั้ง มากกว่าความเร็ว — ทำแต่ละครั้งด้วยความเร็วเท่ากันตลอดทั้งเซต ไม่เร่งเพื่อให้ครบเซตเร็วขึ้น ค่อย ๆ เพิ่มจำนวนครั้งเมื่อทำได้สม่ำเสมอแล้วเท่านั้น',
     'SYSTEM', 'LATE', 2, 'U004', 1200, 'ACTIVE')
  ON CONFLICT DO NOTHING`

  console.log('✅ System programs created (3)')
  console.log('🎉 Seed complete!')
}

seed()
  .catch(e => { console.error('❌', e.message); process.exitCode = 1 })
  .finally(() => sql.end())
