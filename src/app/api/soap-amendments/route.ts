import { db } from '@/src/db'
import { soapAmendments } from '@/src/db/schema/soapAmendments'
import { appointments } from '@/src/db/schema/appointments'
import { users } from '@/src/db/schema/users'
import { dbError } from '@/src/utils/db-error'
import { and, asc, eq, type SQL } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireViewer, authFail, assertOwnPatient, ROLE } from '@/src/utils/auth'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: cors })
const FIELDS = ['S', 'O', 'A', 'P'] as const
const column = { S: 'soap_s', O: 'soap_o', A: 'soap_a', P: 'soap_p' } as const

// GET /api/soap-amendments?patient_id=PAT000001 | ?appointment_id=APT000001 → บันทึกแก้ไขทั้งหมด (เก่าก่อน)
export async function GET(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.THERAPIST)
    const params = new URL(req.url).searchParams
    const conds: SQL[] = []
    if (params.get('patient_id')) conds.push(eq(appointments.patient_id, params.get('patient_id')!))
    if (params.get('appointment_id')) conds.push(eq(soapAmendments.appointment_id, params.get('appointment_id')!))
    if (!conds.length) return fail('ต้องระบุ patient_id หรือ appointment_id')

    const rows = await db
      .select({
        amendment_id: soapAmendments.amendment_id,
        appointment_id: soapAmendments.appointment_id,
        field: soapAmendments.field,
        old_value: soapAmendments.old_value,
        new_value: soapAmendments.new_value,
        reason: soapAmendments.reason,
        amended_by: soapAmendments.amended_by,
        amended_by_name: users.first_name,
        amended_at: soapAmendments.amended_at,
      })
      .from(soapAmendments)
      .innerJoin(appointments, eq(soapAmendments.appointment_id, appointments.appointment_id))
      .leftJoin(users, eq(soapAmendments.amended_by, users.users_id))
      .where(and(...conds))
      .orderBy(asc(soapAmendments.amended_at))
    return NextResponse.json(rows, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

/**
 * POST /api/soap-amendments → แก้บันทึกที่บันทึกผลแล้ว { appointmentId, field: S|O|A|P, newValue, reason, amendedBy }
 * บันทึกเดิมใน appointments ไม่ถูกแก้ (trigger lock_saved_soap) — ค่าปัจจุบัน = แก้ไขล่าสุดของช่องนั้น
 */
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.THERAPIST)
    const body = await req.json()
    const field = String(body.field ?? '').toUpperCase() as (typeof FIELDS)[number]
    if (!body.appointmentId || !FIELDS.includes(field)) return fail('ต้องระบุ appointmentId และ field (S, O, A, P)')
    if (!body.reason?.trim()) return fail('ระบุเหตุผลของการแก้ไข')

    const [appt] = await db.select().from(appointments).where(eq(appointments.appointment_id, body.appointmentId))
    if (!appt) return fail('ไม่พบนัดหมาย', 404)
    if (![appt.ot_id, appt.treated_by].includes(viewer.ot_id)) return fail('แก้บันทึกได้เฉพาะนักกายภาพที่ดูแลหรือรักษานัดนี้', 403)
    if (!appt.soap_saved_at) return fail('ยังไม่ได้บันทึกผล แก้ไขที่บันทึก SOAP ได้โดยตรง')

    const prev = await db.select({ new_value: soapAmendments.new_value }).from(soapAmendments)
      .where(and(eq(soapAmendments.appointment_id, appt.appointment_id), eq(soapAmendments.field, field)))
      .orderBy(asc(soapAmendments.amended_at))
    const current = prev.length ? prev[prev.length - 1].new_value : appt[column[field]]
    if ((current ?? '') === (body.newValue ?? '')) return fail('ข้อความไม่ได้เปลี่ยนจากเดิม')

    await db.insert(soapAmendments).values({
      amendment_id: crypto.randomUUID(),
      appointment_id: appt.appointment_id,
      field,
      old_value: current ?? null,
      new_value: body.newValue ?? null,
      reason: body.reason.trim(),
      amended_by: viewer.users_id,
    })
    return NextResponse.json({ message: 'บันทึกแก้ไขแล้ว · ฉบับเดิมยังเก็บไว้' }, { status: 201, headers: cors })
  } catch (error) {
    const denied = authFail(error, cors)
    if (denied) return denied
    const e = dbError(error)
    return NextResponse.json({ error: e.error }, { status: e.status, headers: cors })
  }
}
