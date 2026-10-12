import { db } from '@/src/db'
import { appointmentRequests } from '@/src/db/schema/appointmentRequests'
import { appointments } from '@/src/db/schema/appointments'
import { patients } from '@/src/db/schema/patients'
import { users } from '@/src/db/schema/users'
import { occupationalTherapists } from '@/src/db/schema/occupationalTherapist'
import { devices } from '@/src/db/schema/devices'
import { generateId } from '@/src/utils/generate-id'
import { ID_PREFIX, SEQUENCE } from '@/src/constants/id-config'
import { dbError } from '@/src/utils/db-error'
import { requireViewer, authFail, ROLE } from '@/src/utils/auth'
import { openCaseOf } from '@/src/services/case.service'
import { SLOT_MIN, SLOT_STARTS } from '@/src/constants/slot'
import { and, asc, eq, isNull, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { NextResponse } from 'next/server'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: cors })
const failDb = (error: unknown) => { const e = dbError(error); return NextResponse.json({ error: e.error }, { status: e.status, headers: cors }) }

const patientUser = alias(users, 'patient_user')
const otUser = alias(users, 'ot_user')
// วันตามเวลาไทย (YYYY-MM-DD) — เวลาเก็บเป็น UTC
const thaiDay = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10)

/**
 * GET /api/appointment-requests?status=PENDING|ALL&patient_id= → คำขอนัด (เก่าก่อน)
 * เวชระเบียนดูคำขอที่รอทั้งหมด · นักกายภาพดูของผู้ป่วยในเคส
 */
export async function GET(req: Request) {
  try {
    requireViewer(req, ROLE.THERAPIST, ROLE.RECORDS)
    const params = new URL(req.url).searchParams
    const conds: SQL[] = []
    const status = params.get('status') ?? 'PENDING'
    if (status !== 'ALL') conds.push(eq(appointmentRequests.status, status))
    if (params.get('patient_id')) conds.push(eq(appointmentRequests.patient_id, params.get('patient_id')!))

    const rows = await db
      .select({
        request_id: appointmentRequests.request_id,
        patient_id: appointmentRequests.patient_id,
        case_id: appointmentRequests.case_id,
        ot_id: appointmentRequests.ot_id,
        window_label: appointmentRequests.window_label,
        earliest_date: appointmentRequests.earliest_date,
        latest_date: appointmentRequests.latest_date,
        note: appointmentRequests.note,
        status: appointmentRequests.status,
        appointment_id: appointmentRequests.appointment_id,
        created_at: appointmentRequests.created_at,
        booked_at: appointmentRequests.booked_at,
        patient_name: patientUser.first_name,
        patient_lastname: patientUser.last_name,
        therapist_name: otUser.first_name,
        therapist_lastname: otUser.last_name,
      })
      .from(appointmentRequests)
      .innerJoin(patients, eq(appointmentRequests.patient_id, patients.patient_id))
      .innerJoin(patientUser, eq(patients.users_id, patientUser.users_id))
      .leftJoin(occupationalTherapists, eq(appointmentRequests.ot_id, occupationalTherapists.ot_id))
      .leftJoin(otUser, eq(occupationalTherapists.users_id, otUser.users_id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(appointmentRequests.created_at))
    return NextResponse.json(rows, { headers: cors })
  } catch (error) {
    return authFail(error, cors) ?? failDb(error)
  }
}

/**
 * POST /api/appointment-requests (นักกายภาพ) → ส่งคำขอนัดครั้งถัดไปให้เวชระเบียน
 * { patientId, label, earliestDate, latestDate, note? } — วันที่เป็น YYYY-MM-DD ตามเวลาไทย
 */
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.THERAPIST)
    const body = await req.json()
    if (!body.patientId || !body.earliestDate || !body.latestDate) return fail('ต้องระบุ patientId และช่วงวันที่ต้องการให้นัด')
    if (body.latestDate < body.earliestDate) return fail('วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น')
    if (body.earliestDate <= thaiDay(new Date())) return fail('ช่วงที่ขอนัดต้องเริ่มตั้งแต่พรุ่งนี้เป็นต้นไป')
    const c = await openCaseOf(body.patientId)
    if (!c || c.status !== 'ACTIVE') return fail('ผู้ป่วยไม่มีเคสที่กำลังรักษา')

    const requestId = await generateId(ID_PREFIX.APPOINTMENT_REQUEST, SEQUENCE.APPOINTMENT_REQUEST)
    await db.insert(appointmentRequests).values({
      request_id: requestId,
      patient_id: body.patientId,
      case_id: c.case_id,
      ot_id: viewer.ot_id ?? c.primary_ot_id,
      requested_by: viewer.users_id,
      window_label: body.label || null,
      earliest_date: body.earliestDate,
      latest_date: body.latestDate,
      note: body.note || null,
    })
    return NextResponse.json({ message: 'ส่งคำขอนัดให้เวชระเบียนแล้ว', request_id: requestId }, { status: 201, headers: cors })
  } catch (error) {
    return authFail(error, cors) ?? failDb(error)
  }
}

/**
 * PATCH /api/appointment-requests { requestId, action }
 *   BOOK   (เวชระเบียน) { appointmentDate } → ลงนัดฝึกจริงในช่องที่เลือก ต้องอยู่ในช่วงที่นักกายภาพขอ
 *   CANCEL (นักกายภาพ / เวชระเบียน) ยกเลิกคำขอ
 * ช่องชนกัน / ผู้ป่วยมีนัดวันนั้นแล้ว ฐานข้อมูลปฏิเสธเอง (exclusion constraint, unique index)
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const viewer = requireViewer(req, ...(body.action === 'BOOK' ? [ROLE.RECORDS] : [ROLE.RECORDS, ROLE.THERAPIST]))
    if (!body.requestId) return fail('ต้องระบุ requestId')
    const [r] = await db.select().from(appointmentRequests).where(eq(appointmentRequests.request_id, body.requestId))
    if (!r) return fail('ไม่พบคำขอนัด', 404)
    if (r.status !== 'PENDING') return fail('คำขอนี้ถูกจัดการไปแล้ว')

    if (body.action === 'CANCEL') {
      await db.update(appointmentRequests).set({ status: 'CANCELLED' }).where(eq(appointmentRequests.request_id, r.request_id))
      return NextResponse.json({ message: 'ยกเลิกคำขอนัดแล้ว' }, { headers: cors })
    }
    if (body.action !== 'BOOK') return fail('action ไม่ถูกต้อง')

    if (!body.appointmentDate) return fail('เลือกวันและช่องเวลาก่อน')
    const at = new Date(body.appointmentDate)
    const day = thaiDay(at)
    if (day < r.earliest_date || day > r.latest_date) return fail('วันที่เลือกอยู่นอกช่วงที่นักกายภาพขอ')
    if (at <= new Date()) return fail('เลือกช่องเวลาที่ยังไม่ผ่านไป')
    const th = new Date(at.getTime() + 7 * 3600_000)
    const hhmm = `${String(th.getUTCHours()).padStart(2, '0')}:${String(th.getUTCMinutes()).padStart(2, '0')}`
    if (!SLOT_STARTS.includes(hhmm)) return fail('ช่องเวลาไม่ถูกต้อง')

    const c = await openCaseOf(r.patient_id)
    if (!c || c.status !== 'ACTIVE') return fail('ผู้ป่วยไม่มีเคสที่กำลังรักษาแล้ว')
    const otId = r.ot_id ?? c.primary_ot_id
    if (!otId) return fail('คำขอนี้ไม่ระบุนักกายภาพ')
    const [dev] = await db.select({ device_id: devices.device_id }).from(devices)
      .where(eq(devices.status, 'ACTIVE')).orderBy(asc(devices.device_id)).limit(1)
    if (!dev) return fail('ยังไม่มีกระดานที่ใช้งานได้')

    const appointmentId = await generateId(ID_PREFIX.APPOINTMENT, SEQUENCE.APPOINTMENT)
    await db.transaction(async (tx) => {
      await tx.insert(appointments).values({
        appointment_id: appointmentId, patient_id: r.patient_id, case_id: c.case_id, ot_id: otId, created_by: viewer.users_id,
        device_id: dev.device_id, appointment_date: at, duration_min: SLOT_MIN, appointment_type: 'TRAINING', status: 'SCHEDULED',
        note: r.note || null,
      })
      await tx.update(appointmentRequests).set({ status: 'BOOKED', appointment_id: appointmentId, booked_by: viewer.users_id, booked_at: new Date() })
        .where(eq(appointmentRequests.request_id, r.request_id))
      // ลงนัดครั้งถัดไปแล้ว = งานสรุปผลของการมาครั้งก่อนเสร็จ → ปิดงานให้เลย ไม่ต้องกดเสร็จสิ้นซ้ำ
      await tx.update(appointments).set({ records_done_at: new Date(), records_done_by: viewer.users_id })
        .where(and(eq(appointments.patient_id, r.patient_id), eq(appointments.status, 'COMPLETED'), isNull(appointments.records_done_at)))
    })
    return NextResponse.json({ message: 'บันทึกนัดแล้ว', appointment_id: appointmentId }, { headers: cors })
  } catch (error) {
    return authFail(error, cors) ?? failDb(error)
  }
}
