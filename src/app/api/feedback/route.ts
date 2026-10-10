import { db } from '@/src/db'
import { appointments } from '@/src/db/schema/appointments'
import { soapAmendments } from '@/src/db/schema/soapAmendments'
import { occupationalTherapists } from '@/src/db/schema/occupationalTherapist'
import { users } from '@/src/db/schema/users'
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireViewer, authFail, assertOwnPatient, ROLE } from '@/src/utils/auth'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

/**
 * GET /api/feedback?patient_id=PAT000001 → คำแนะนำที่ผู้ป่วยเห็นในแอป (ล่าสุดก่อน)
 * มาจากส่วน P ของบันทึก SOAP ที่บันทึกผลแล้วเท่านั้น · ถ้ามีบันทึกแก้ไขของ P ใช้ฉบับแก้ไขล่าสุด
 */
export async function GET(req: Request) {
  try {
    const viewer = requireViewer(req)
    const patientId = new URL(req.url).searchParams.get('patient_id')
    assertOwnPatient(viewer, patientId)
    if (!patientId) return NextResponse.json({ error: 'ต้องระบุ patient_id' }, { status: 400, headers: cors })

    const rows = await db
      .select({
        appointment_id: appointments.appointment_id,
        comment: appointments.soap_p,
        created_at: appointments.soap_saved_at,
        session_date: appointments.appointment_date,
        therapist_name: users.first_name,
        therapist_lastname: users.last_name,
      })
      .from(appointments)
      .leftJoin(occupationalTherapists, eq(occupationalTherapists.ot_id, appointments.treated_by))
      .leftJoin(users, eq(occupationalTherapists.users_id, users.users_id))
      .where(and(eq(appointments.patient_id, patientId), isNotNull(appointments.soap_saved_at)))
      .orderBy(desc(appointments.soap_saved_at))

    const amended = await db
      .select({ appointment_id: soapAmendments.appointment_id, new_value: soapAmendments.new_value })
      .from(soapAmendments)
      .innerJoin(appointments, eq(soapAmendments.appointment_id, appointments.appointment_id))
      .where(and(eq(appointments.patient_id, patientId), eq(soapAmendments.field, 'P')))
      .orderBy(asc(soapAmendments.amended_at))
    const latestP = new Map(amended.map(a => [a.appointment_id, a.new_value]))

    const advice = rows
      .map(r => ({
        feedback_id: r.appointment_id,
        session_id: r.appointment_id,
        comment: latestP.has(r.appointment_id) ? latestP.get(r.appointment_id)! : r.comment,
        rating: null,
        created_at: r.created_at,
        session_date: r.session_date,
        therapist_name: r.therapist_name,
        therapist_lastname: r.therapist_lastname,
      }))
      .filter(r => r.comment)
    return NextResponse.json(advice, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}
