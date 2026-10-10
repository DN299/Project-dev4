import { db } from '@/src/db'
import { therapySessions } from '@/src/db/schema/therapySession'
import { patientPrograms } from '@/src/db/schema/patientProgram'
import { programs } from '@/src/db/schema/program'
import { movementData } from '@/src/db/schema/movementData'
import { eq, desc, sum } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireViewer, authFail, assertOwnPatient, ROLE } from '@/src/utils/auth'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

// GET /api/sessions?patient_id=PAT000001 → ผลรายเซตของผู้ป่วย (ล่าสุดก่อน)
// GET /api/sessions?ot_id=OT000001       → ทุกเซตภายใต้โปรแกรมที่นักกายภาพคนนี้มอบหมาย
// เซตเกิดจากกระดานเท่านั้น (POST /api/devices/telemetry) — ฐานข้อมูลรับเฉพาะนัดที่กำลังฝึกอยู่
export async function GET(req: Request) {
  try {
    const viewer = requireViewer(req)
    const params = new URL(req.url).searchParams
    // ผู้ป่วยเห็นเฉพาะผลของตัวเอง · ดูตามนักกายภาพได้เฉพาะนักกายภาพ
    const patientId = viewer.role_id === ROLE.PATIENT ? viewer.patient_id : params.get('patient_id')
    const otId = viewer.role_id === ROLE.THERAPIST ? params.get('ot_id') : null
    if (!patientId && !otId) {
      return NextResponse.json({ error: 'ต้องระบุ patient_id หรือ ot_id' }, { status: 400, headers: cors })
    }

    const rows = await db
      .select({
        session_id: therapySessions.session_id,
        session_date: therapySessions.session_date,
        duration_sec: therapySessions.duration_sec,
        total_reps: therapySessions.total_reps,
        status: therapySessions.status,
        set_number: therapySessions.set_number,
        fatigue_level: therapySessions.fatigue_level,
        patient_comment: therapySessions.patient_comment,
        appointment_id: therapySessions.appointment_id,
        program_id: programs.program_id,
        program_name: programs.program_name,
        patient_id: patientPrograms.patient_id,
        movement_count: sum(movementData.movement_count),
      })
      .from(therapySessions)
      .innerJoin(patientPrograms, eq(therapySessions.patient_program_id, patientPrograms.patient_program_id))
      .innerJoin(programs, eq(patientPrograms.program_id, programs.program_id))
      .leftJoin(movementData, eq(movementData.session_id, therapySessions.session_id))
      .where(patientId ? eq(patientPrograms.patient_id, patientId) : eq(patientPrograms.assigned_by, otId!))
      .groupBy(therapySessions.session_id, programs.program_id, patientPrograms.patient_id)
      .orderBy(desc(therapySessions.session_date))

    return NextResponse.json(rows, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// PATCH /api/sessions → ผู้ป่วยให้คะแนนความเหนื่อยหลังจบเซต { sessionId, fatigueLevel: 1–5, comment? }
export async function PATCH(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.PATIENT, ROLE.THERAPIST)
    const body = await req.json()
    const level = Number(body.fatigueLevel)
    if (!body.sessionId || !Number.isInteger(level) || level < 1 || level > 5) {
      return NextResponse.json({ error: 'ต้องระบุ sessionId และ fatigueLevel (1–5)' }, { status: 400, headers: cors })
    }
    // ผู้ป่วยให้คะแนนได้เฉพาะเซตของตัวเอง
    if (viewer.role_id === ROLE.PATIENT) {
      const [own] = await db.select({ patient_id: patientPrograms.patient_id }).from(therapySessions)
        .innerJoin(patientPrograms, eq(therapySessions.patient_program_id, patientPrograms.patient_program_id))
        .where(eq(therapySessions.session_id, body.sessionId))
      assertOwnPatient(viewer, own?.patient_id)
    }
    const patch: Record<string, unknown> = { fatigue_level: level }
    if (body.comment !== undefined) patch.patient_comment = body.comment || null
    const updated = await db
      .update(therapySessions)
      .set(patch)
      .where(eq(therapySessions.session_id, body.sessionId))
      .returning({ session_id: therapySessions.session_id })
    if (updated.length === 0) {
      return NextResponse.json({ error: 'ไม่พบเซตการฝึกนี้' }, { status: 404, headers: cors })
    }
    return NextResponse.json({ message: 'บันทึกความเหนื่อยสำเร็จ' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}
