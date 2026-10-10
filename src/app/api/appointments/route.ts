import { db } from '@/src/db'
import { appointments } from '@/src/db/schema/appointments'
import { patients } from '@/src/db/schema/patients'
import { users } from '@/src/db/schema/users'
import { occupationalTherapists } from '@/src/db/schema/occupationalTherapist'
import { treatmentCases } from '@/src/db/schema/treatmentCases'
import { devices } from '@/src/db/schema/devices'
import { generateId } from '@/src/utils/generate-id'
import { ID_PREFIX, SEQUENCE } from '@/src/constants/id-config'
import { dbError } from '@/src/utils/db-error'
import { requireViewer, authFail, ROLE, type RoleId, type Viewer } from '@/src/utils/auth'
import { openCaseOf } from '@/src/services/case.service'
import { eq, asc, and, gte, lt, isNotNull, isNull, ne, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { NextResponse } from 'next/server'
import { SLOT_MIN } from '@/src/constants/slot'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

const patientUser = alias(users, 'patient_user')
const otUser = alias(users, 'ot_user')
const treater = alias(occupationalTherapists, 'treater')
const treaterUser = alias(users, 'treater_user')
const checkinUser = alias(users, 'checkin_user')

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: cors })
const failDb = (error: unknown) => { const e = dbError(error); return NextResponse.json({ error: e.error }, { status: e.status, headers: cors }) }

// GET /api/appointments                         → นัดทั้งหมด
// GET /api/appointments?patient_id=P123456      → นัดของผู้ป่วยคนนั้น
// GET /api/appointments?from=ISO&to=ISO         → นัดในช่วงเวลา (from ≤ วันนัด < to)
// GET /api/appointments?ot_id=OT001             → นัดของนักกายภาพคนนั้น
export async function GET(req: Request) {
  try {
    const viewer = requireViewer(req)
    const params = new URL(req.url).searchParams
    const conds: SQL[] = []
    const patientId = params.get('patient_id'), otId = params.get('ot_id'), from = params.get('from'), to = params.get('to')
    if (patientId) conds.push(eq(appointments.patient_id, patientId))
    if (otId) conds.push(eq(appointments.ot_id, otId))
    if (from) conds.push(gte(appointments.appointment_date, new Date(from)))
    if (to) conds.push(lt(appointments.appointment_date, new Date(to)))

    const rows = await db
      .select({
        appointment_id: appointments.appointment_id,
        patient_id: appointments.patient_id,
        case_id: appointments.case_id,
        patient_name: patientUser.first_name,
        patient_lastname: patientUser.last_name,
        ot_id: appointments.ot_id,
        therapist_name: otUser.first_name,
        therapist_lastname: otUser.last_name,
        treated_by: appointments.treated_by,
        treated_by_name: treaterUser.first_name,
        primary_ot_id: treatmentCases.primary_ot_id,
        device_id: appointments.device_id,
        device_name: devices.device_name,
        device_status: devices.status,
        appointment_date: appointments.appointment_date,
        duration_min: appointments.duration_min,
        appointment_type: appointments.appointment_type,
        treated_side: appointments.treated_side,
        affected_side: treatmentCases.affected_side,
        current_stage: treatmentCases.current_stage,
        status: appointments.status,
        note: appointments.note,
        created_by: appointments.created_by,
        checked_in_at: appointments.checked_in_at,
        checked_in_by_name: checkinUser.first_name,
        called_at: appointments.called_at,
        started_at: appointments.started_at,
        completed_at: appointments.completed_at,
        symptoms_today: appointments.symptoms_today,
        weight_kg: appointments.weight_kg,
        soap_s: appointments.soap_s,
        soap_o: appointments.soap_o,
        soap_a: appointments.soap_a,
        soap_p: appointments.soap_p,
        soap_saved_at: appointments.soap_saved_at,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patient_id, patients.patient_id))
      .leftJoin(patientUser, eq(patients.users_id, patientUser.users_id))
      .leftJoin(occupationalTherapists, eq(appointments.ot_id, occupationalTherapists.ot_id))
      .leftJoin(otUser, eq(occupationalTherapists.users_id, otUser.users_id))
      .leftJoin(treater, eq(appointments.treated_by, treater.ot_id))
      .leftJoin(treaterUser, eq(treater.users_id, treaterUser.users_id))
      .leftJoin(treatmentCases, eq(appointments.case_id, treatmentCases.case_id))
      .leftJoin(checkinUser, eq(appointments.checked_in_by, checkinUser.users_id))
      .leftJoin(devices, eq(appointments.device_id, devices.device_id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(appointments.appointment_date))

    return NextResponse.json(rows.map(r => visibleTo(viewer, { ...r, weight_kg: r.weight_kg != null ? Number(r.weight_kg) : null })), { headers: cors })
  } catch (error: any) {
    return authFail(error, cors) ?? NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

type Row = Record<string, unknown> & { patient_id: string; ot_id: string | null; treated_by: string | null; primary_ot_id: string | null; soap_saved_at: Date | null }

/**
 * เห็นข้อมูลเท่าที่บทบาทจำเป็น (ข้อมูลสุขภาพ ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล)
 * - ผู้ป่วย: นัดของตัวเองโดยไม่มี SOAP (คำแนะนำดูที่ /api/feedback) · นัดของคนอื่นเห็นแค่เวลาและสถานะ (ใช้นับคิวก่อนหน้า)
 * - เวชระเบียน: ข้อมูลนัด + สรุปผล (A) และคำแนะนำ (P) — ไม่เห็น S/O
 * - นักกายภาพ: SOAP ฉบับเต็มเฉพาะเคสของตัวเอง (ประจำเคส ลงนัด หรือรักษาเอง)
 */
function visibleTo(viewer: Viewer, r: Row) {
  if (viewer.role_id === ROLE.PATIENT) {
    if (r.patient_id !== viewer.patient_id) {
      return { appointment_id: r.appointment_id, appointment_date: r.appointment_date, appointment_type: r.appointment_type, status: r.status, device_id: r.device_id, called_at: r.called_at }
    }
    return { ...r, soap_s: null, soap_o: null, soap_a: null, soap_p: null }
  }
  if (viewer.role_id === ROLE.RECORDS) return { ...r, soap_s: null, soap_o: null }
  const mine = [r.ot_id, r.treated_by, r.primary_ot_id].includes(viewer.ot_id)
  return mine ? r : { ...r, soap_s: null, soap_o: null, soap_a: null, soap_p: null }
}

const firstActiveDevice = async () => {
  const [d] = await db.select({ device_id: devices.device_id }).from(devices)
    .where(eq(devices.status, 'ACTIVE')).orderBy(asc(devices.device_id)).limit(1)
  return d?.device_id ?? null
}

/**
 * POST /api/appointments → นักกายภาพลงนัดฝึกครั้งถัดไป { patientId, otId, createdBy, appointmentDate }
 * นัดอยู่ในเคสที่เปิดอยู่ของผู้ป่วยเสมอ · ช่องชน / นัดซ้ำวัน ฐานข้อมูลปฏิเสธเอง (exclusion constraint, unique index)
 */
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.THERAPIST)
    const body = await req.json()
    if (!body.patientId || !body.appointmentDate || !body.otId) return fail('ต้องระบุ patientId, otId และ appointmentDate')

    const c = await openCaseOf(body.patientId)
    if (!c || c.status !== 'ACTIVE') return fail('ผู้ป่วยไม่มีเคสที่กำลังรักษา (ต้องผ่านการประเมินก่อน หรือเคสถูกปิดแล้ว)')
    const deviceId = body.deviceId || (await firstActiveDevice())
    if (!deviceId) return fail('ยังไม่มีกระดานที่ใช้งานได้')

    const appointmentId = await generateId(ID_PREFIX.APPOINTMENT, SEQUENCE.APPOINTMENT)
    await db.insert(appointments).values({
      appointment_id: appointmentId,
      patient_id: body.patientId,
      case_id: c.case_id,
      ot_id: body.otId,
      created_by: viewer.users_id,
      device_id: deviceId,
      appointment_date: new Date(body.appointmentDate),
      duration_min: SLOT_MIN,
      appointment_type: 'TRAINING',
      status: 'SCHEDULED',
      note: body.note || null,
    })
    return NextResponse.json({ message: 'บันทึกนัดหมายสำเร็จ', appointment_id: appointmentId }, { status: 201, headers: cors })
  } catch (error) {
    return authFail(error, cors) ?? failDb(error)
  }
}

/**
 * PATCH /api/appointments → เดินคิว { appointmentId, action, ... }
 *   CHECK_IN  (เวชระเบียน) รับเข้าคิว + อาการ/น้ำหนักวันนี้ { checkedInBy, symptomsToday, weightKg }
 *   CALL      (เวชระเบียน) เรียกคิวถัดไป — ได้เมื่อถึงเวลานัดและกระดานว่าง { calledBy }
 *   START     (นักกายภาพ) ยืนยันตัวผู้ป่วยแล้วเชื่อมต่อกระดาน { treatedBy, confirmPatientId }
 *   NEXT_SET  (นักกายภาพ) สั่งกระดานเริ่มเซตถัดไป
 *   COMPLETE  (นักกายภาพ) จบการฝึก — ฐานข้อมูลปล่อยกระดานให้อัตโนมัติ
 *   NO_SHOW / CANCEL
 * ไม่ระบุ action = บันทึก SOAP { soapS, soapO, soapA, soapP, saveSoap } (บันทึกผลแล้วแก้ผ่าน /api/soap-amendments เท่านั้น)
 * ลำดับสถานะและการผูก/ปล่อยกระดาน บังคับโดย trigger ในฐานข้อมูล
 */
const ACTION_ROLES: Record<string, RoleId[]> = {
  CHECK_IN: [ROLE.RECORDS],
  CALL: [ROLE.RECORDS],
  START: [ROLE.THERAPIST],
  NEXT_SET: [ROLE.THERAPIST],
  COMPLETE: [ROLE.THERAPIST],
  NO_SHOW: [ROLE.RECORDS, ROLE.THERAPIST],
  CANCEL: [ROLE.THERAPIST],
  SOAP: [ROLE.THERAPIST],
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const viewer = requireViewer(req, ...(ACTION_ROLES[body.action ?? 'SOAP'] ?? [ROLE.THERAPIST]))
    if (!body.appointmentId) return fail('ต้องระบุ appointmentId')

    const [appt] = await db.select().from(appointments).where(eq(appointments.appointment_id, body.appointmentId))
    if (!appt) return fail('ไม่พบนัดหมาย', 404)

    const patch: Record<string, unknown> = {}
    const now = new Date()

    switch (body.action) {
      case 'CHECK_IN':
        patch.status = 'CHECKED_IN'
        patch.checked_in_at = now
        patch.checked_in_by = viewer.users_id
        if (body.symptomsToday !== undefined) patch.symptoms_today = body.symptomsToday || null
        if (body.weightKg !== undefined) patch.weight_kg = body.weightKg === '' || body.weightKg == null ? null : String(Number(body.weightKg))
        break
      case 'CALL': {
        if (appt.status !== 'CHECKED_IN') return fail('เรียกคิวได้เฉพาะผู้ป่วยที่รับเข้าคิวแล้ว')
        if (appt.appointment_date > now) return fail('ยังไม่ถึงช่องเวลาของผู้ป่วยคนนี้')
        const [busy] = await db.select({ id: appointments.appointment_id }).from(appointments).where(and(
          eq(appointments.device_id, appt.device_id!), ne(appointments.appointment_id, appt.appointment_id),
          eq(appointments.status, 'IN_PROGRESS'),
        )).limit(1)
        const [waiting] = await db.select({ id: appointments.appointment_id }).from(appointments).where(and(
          eq(appointments.device_id, appt.device_id!), ne(appointments.appointment_id, appt.appointment_id),
          eq(appointments.status, 'CHECKED_IN'), isNotNull(appointments.called_at),
        )).limit(1)
        if (busy || waiting) return fail('ยังมีผู้ป่วยใช้กระดานอยู่ รอให้รักษาเสร็จก่อน', 409)
        patch.called_at = now
        patch.called_by = viewer.users_id
        break
      }
      case 'START':
        // ความผิดพลาดที่อันตรายที่สุดของระบบเครื่องเดียวหลายคน คือการเชื่อมผิดคน
        if (body.confirmPatientId !== appt.patient_id) return fail('ยืนยันชื่อและ HN ของผู้ป่วยก่อนเชื่อมต่อกระดาน')
        patch.status = 'IN_PROGRESS'
        // ผู้รักษาจริง = นักกายภาพที่ล็อกอินและเชื่อมต่อกระดาน
        patch.treated_by = viewer.ot_id
        if (!appt.device_id) patch.device_id = await firstActiveDevice()
        break
      case 'NEXT_SET': {
        if (appt.status !== 'IN_PROGRESS') return fail('ยังไม่ได้เชื่อมต่อกระดาน')
        const updated = await db.update(devices).set({ pending_command: 'START' })
          .where(and(eq(devices.current_appointment_id, appt.appointment_id), eq(devices.live_status, 'IDLE')))
          .returning({ id: devices.device_id })
        if (!updated.length) return fail('กระดานกำลังนับเซตอยู่ หรือไม่ได้ผูกกับนัดนี้')
        return NextResponse.json({ message: 'สั่งเริ่มเซตถัดไปแล้ว' }, { headers: cors })
      }
      case 'COMPLETE':
        patch.status = 'COMPLETED'
        break
      case 'NO_SHOW':
        patch.status = 'NO_SHOW'
        break
      case 'CANCEL':
        patch.status = 'CANCELLED'
        break
      case undefined:
        for (const k of ['S', 'O', 'A', 'P'] as const) {
          const v = body[`soap${k}`]
          if (v !== undefined) patch[`soap_${k.toLowerCase()}`] = v || null
        }
        if (body.saveSoap) {
          if (appt.status !== 'COMPLETED' && appt.status !== 'IN_PROGRESS') return fail('บันทึกผลได้หลังเชื่อมต่อกระดานแล้วเท่านั้น')
          patch.soap_saved_at = now
        }
        break
      default:
        return fail('action ไม่ถูกต้อง')
    }

    if (Object.keys(patch).length === 0) return fail('ไม่มีข้อมูลที่จะแก้ไข')
    // สถานะเดินทางเดียว: ใส่เงื่อนไขสถานะเดิมไว้ด้วย กันกดซ้ำพร้อมกันสองเครื่อง
    const res = await db.update(appointments).set(patch)
      .where(and(eq(appointments.appointment_id, appt.appointment_id), eq(appointments.status, appt.status),
        body.action === 'CALL' ? isNull(appointments.called_at) : undefined))
      .returning({ id: appointments.appointment_id })
    if (!res.length) return fail('สถานะของนัดเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่', 409)

    return NextResponse.json({ message: 'บันทึกสำเร็จ' }, { headers: cors })
  } catch (error) {
    return authFail(error, cors) ?? failDb(error)
  }
}
