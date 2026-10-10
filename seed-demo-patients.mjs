// ข้อมูลตัวอย่างสำหรับเริ่มใช้ระบบ: ผู้ป่วย 10 คนที่ผ่านการประเมินแล้ว (เคสกำลังรักษา + โปรแกรม)
// และมีนัดฝึกกับกระดานวันพรุ่งนี้ 5 คน มะรืนนี้ 5 คน · ยังไม่มีผลการฝึกหรือค่าจากอุปกรณ์
// ทุกคนล็อกอินแอปผู้ป่วยได้ด้วยเบอร์โทร และรหัสผ่านเริ่มต้น 1234
// วิธีใช้: node seed-demo-patients.mjs   (รันซ้ำได้ — คนที่มีเบอร์อยู่แล้วจะข้าม)
import 'dotenv/config'
import postgres from 'postgres'
import bcrypt from 'bcrypt'

const sql = postgres(process.env.DATABASE_URL.replace(':5432/', ':6543/'), { ssl: 'require' })

const DEFAULT_PASSWORD = '1234'
const SLOT_MIN = 60
const SLOT_STARTS = ['09:00', '10:00', '11:00', '13:00', '14:00'] // เว้น 15:00 ไว้ให้ลงนัดเพิ่ม
const PROGRAM_BY_STAGE = { EARLY: 'PRGSYS001', MIDDLE: 'PRGSYS002', LATE: 'PRGSYS003' }
const OT = { A: { ot_id: 'OT001', users_id: 'U004' }, B: { ot_id: 'OT443773', users_id: 'U443773' } }

const PATIENTS = [
  ['สมชาย', 'ใจดี', 'ชาย', '1961-03-14', 'บุตร', 'สมหญิง ใจดี', true, 'มือขวาอ่อนแรง หยิบจับของลำบาก', 3, 'มือขวา ข้อมือขวา', '1–6 เดือน', 'ข้างขวา', 'EARLY', 'กำลังกล้ามเนื้อมือขวาลดลงเล็กน้อย ช่วงการเคลื่อนไหวปกติ', 'A'],
  ['มานี', 'มีสุข', 'หญิง', '1958-07-02', 'คู่สมรส', 'ประเสริฐ มีสุข', true, 'แขนซ้ายล้าเร็ว ยกแขนได้ไม่สุด', 4, 'ไหล่ซ้าย แขนซ้าย', '6–12 เดือน', 'ข้างซ้าย', 'MIDDLE', 'แขนซ้ายเกร็งเล็กน้อยช่วงท้าย ควรยืดเหยียดก่อนฝึก', 'B'],
  ['ชูใจ', 'ใฝ่ดี', 'หญิง', '1965-11-21', 'บุตร', 'วิไล ใฝ่ดี', true, 'นิ้วมือซ้ายอ่อนแรง เขียนหนังสือลำบาก', 2, 'มือซ้าย', 'น้อยกว่า 1 เดือน', 'ข้างซ้าย', 'EARLY', 'เริ่มมีอาการ กล้ามเนื้อมือซ้ายอ่อนแรงเล็กน้อย', 'A'],
  ['ปิติ', 'พอใจ', 'ชาย', '1955-01-30', 'บุตร', 'อรุณ พอใจ', false, 'แขนทั้งสองข้างอ่อนแรง ล้าง่าย', 5, 'แขนทั้งสองข้าง', 'มากกว่า 1 ปี', 'ทั้งสองข้าง', 'MIDDLE', 'อ่อนแรงทั้งสองข้าง ข้างขวามากกว่า เฝ้าระวังความเหนื่อย', 'A'],
  ['วีระ', 'กล้าหาญ', 'ชาย', '1970-05-09', 'คู่สมรส', 'สุดา กล้าหาญ', true, 'มือขวาสั่น หยิบของหล่นบ่อย', 3, 'มือขวา', '1–6 เดือน', 'ข้างขวา', 'EARLY', 'แรงบีบมือขวาลดลง ยังทำกิจวัตรได้เอง', 'B'],
  ['อารีย์', 'ศรีสุข', 'หญิง', '1960-09-17', 'บุตร', 'กมล ศรีสุข', true, 'ไหล่ขวาตึง แขนขวาล้า', 4, 'ไหล่ขวา', '6–12 เดือน', 'ข้างขวา', 'MIDDLE', 'ไหล่ขวาเกร็ง ช่วงการเคลื่อนไหวลดลง', 'A'],
  ['ประยูร', 'แสงทอง', 'ชาย', '1952-12-05', 'บุตร', 'ประภา แสงทอง', true, 'แขนขวาอ่อนแรงมาก ต้องมีคนช่วยประคอง', 6, 'แขนขวา มือขวา', 'มากกว่า 1 ปี', 'ข้างขวา', 'LATE', 'อ่อนแรงมาก ฝึกเบา ๆ เน้นคงความสามารถไว้', 'B'],
  ['วิภา', 'ทองดี', 'หญิง', '1967-04-26', 'พี่น้อง', 'วิชัย ทองดี', false, 'มือซ้ายชา กำมือได้ไม่แน่น', 2, 'มือซ้าย', '1–6 เดือน', 'ข้างซ้าย', 'EARLY', 'กำลังกล้ามเนื้อมือซ้ายลดลงเล็กน้อย', 'A'],
  ['สมศรี', 'รักงาม', 'หญิง', '1950-08-11', 'บุตร', 'สมพร รักงาม', true, 'แขนทั้งสองข้างอ่อนแรง เหนื่อยง่าย', 5, 'แขนทั้งสองข้าง', 'มากกว่า 1 ปี', 'ทั้งสองข้าง', 'LATE', 'เหนื่อยง่าย พักระหว่างเซตนานขึ้น ผู้ดูแลช่วยประคอง', 'B'],
  ['บุญมี', 'ศรีทอง', 'ชาย', '1963-02-19', 'คู่สมรส', 'มาลัย ศรีทอง', true, 'แขนซ้ายล้า ยกของหนักไม่ได้', 3, 'แขนซ้าย', '6–12 เดือน', 'ข้างซ้าย', 'MIDDLE', 'แขนซ้ายเกร็งปานกลาง ยืดเหยียดก่อนฝึกทุกครั้ง', 'A'],
]

// วันที่ตามเวลาไทย · เวลาเก็บในฐานข้อมูลเป็น UTC (ไทย = UTC+7)
const bangkokToday = () => { const n = new Date(Date.now() + 7 * 3600_000); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) }
const nextOpenDay = (from) => { const d = new Date(from); do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() === 0); return d } // ปิดวันอาทิตย์
const slotUtc = (day, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h - 7, m)) }
const ymd = (d) => d.toISOString().slice(0, 10)
// ส่งเวลาเป็นข้อความ UTC แล้ว cast ::text::timestamp — ถ้าผูกเป็น timestamp ตรง ๆ ไดรเวอร์ postgres จะตีความเป็นเวลาเครื่อง (ไทย) แล้วเลื่อน 7 ชม.
const utc = (d) => d.toISOString().replace('T', ' ').slice(0, 19)
const id = async (prefix, seq) => `${prefix}${String((await sql.unsafe(`select nextval('${seq}') as n`))[0].n).padStart(6, '0')}`

async function seed() {
  const today = bangkokToday()
  const day1 = nextOpenDay(today), day2 = nextOpenDay(day1)
  const [board] = await sql`select device_id from devices where status = 'ACTIVE' order by device_id limit 1`
  if (!board) throw new Error('ไม่มีกระดานที่ใช้งานได้')
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10)
  console.log(`🌱 นัดฝึกวันที่ ${ymd(day1)} และ ${ymd(day2)} · กระดาน ${board.device_id}`)

  let made = 0
  for (const [i, p] of PATIENTS.entries()) {
    const [first, last, gender, birth, relation, caretaker, canUseApp, complaint, pain, location, onset, side, stage, note, otKey] = p
    const phone = `08900001${String(i + 1).padStart(2, '0')}`
    const ot = OT[otKey]
    const day = i < 5 ? day1 : day2
    const at = slotUtc(day, SLOT_STARTS[i % 5])
    const assessedAt = new Date(today.getTime() - (3 + i) * 86400_000 + 3 * 3600_000) // ประเมินไปเมื่อไม่กี่วันก่อน

    const [exists] = await sql`select users_id from users where username = ${phone}`
    if (exists) { console.log(`↷ ข้าม ${first} ${last} (มีเบอร์ ${phone} แล้ว)`); continue }

    const usersId = await id('USR', 'users_id_seq')
    const patientId = await id('PAT', 'patient_id_seq')
    const caseId = await id('CS', 'case_id_seq')
    const ppId = await id('PPG', 'patient_program_id_seq')
    const apptId = await id('APT', 'appointment_id_seq')

    await sql.begin(async (tx) => {
      await tx`insert into users (users_id, role_id, username, password, first_name, last_name, phone, gender, birth_date, status)
        values (${usersId}, 'R001', ${phone}, ${hash}, ${first}, ${last}, ${phone}, ${gender}, ${birth}, 'ACTIVE')`
      await tx`insert into patients (patient_id, users_id, register_date, address, caretaker_name, caretaker_phone, caretaker_relation, caretaker_can_use_app)
        values (${patientId}, ${usersId}, ${ymd(assessedAt)}, ${`${10 + i * 7}/${i + 3} ถ.ตัวอย่าง กรุงเทพฯ`}, ${caretaker}, ${`08900002${String(i + 1).padStart(2, '0')}`}, ${relation}, ${canUseApp})`
      await tx`insert into treatment_cases (case_id, patient_id, primary_ot_id, status, chief_complaint, pain_level, symptom_location, onset_duration,
          affected_side, start_stage, current_stage, assessment_note, assessed_at, opened_at)
        values (${caseId}, ${patientId}, ${ot.ot_id}, 'ACTIVE', ${complaint}, ${pain}, ${location}, ${onset},
          ${side}, ${stage}, ${stage}, ${note}, ${utc(assessedAt)}::text::timestamp, ${utc(assessedAt)}::text::timestamp)`
      await tx`insert into patient_programs (patient_program_id, patient_id, case_id, program_id, assigned_by, assigned_date, start_date, status)
        values (${ppId}, ${patientId}, ${caseId}, ${PROGRAM_BY_STAGE[stage]}, ${ot.ot_id}, ${ymd(assessedAt)}, ${ymd(assessedAt)}, 'ACTIVE')`
      await tx`insert into appointments (appointment_id, patient_id, case_id, ot_id, created_by, device_id, appointment_date, duration_min, appointment_type, status)
        values (${apptId}, ${patientId}, ${caseId}, ${ot.ot_id}, ${ot.users_id}, ${board.device_id}, ${utc(at)}::text::timestamp, ${SLOT_MIN}, 'TRAINING', 'SCHEDULED')`
    })
    made++
    console.log(`✅ ${patientId} ${first} ${last} · ${stage} · นัด ${ymd(day)} ${SLOT_STARTS[i % 5]} · ${ot.ot_id} · เบอร์ ${phone}`)
  }
  console.log(`🎉 เพิ่มผู้ป่วย ${made} คน`)
}

seed().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => sql.end())
