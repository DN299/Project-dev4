import { db } from '@/src/db'
import { patientPrograms } from '@/src/db/schema/patientProgram'
import { programs } from '@/src/db/schema/program'
import { generateId } from '@/src/utils/generate-id'
import { ID_PREFIX, SEQUENCE } from '@/src/constants/id-config'
import { dbError } from '@/src/utils/db-error'
import { openCaseOf } from '@/src/services/case.service'
import { eq, and, desc } from 'drizzle-orm'
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

// GET /api/patient-programs?patient_id=PAT000001 → โปรแกรมที่มอบให้ผู้ป่วยในทุกเคส (ล่าสุดก่อน)
export async function GET(req: Request) {
  try {
    const viewer = requireViewer(req)
    const patientId = new URL(req.url).searchParams.get('patient_id')
    assertOwnPatient(viewer, patientId)
    if (!patientId) return NextResponse.json({ error: 'ต้องระบุ patient_id' }, { status: 400, headers: cors })

    const rows = await db
      .select({
        patient_program_id: patientPrograms.patient_program_id,
        patient_id: patientPrograms.patient_id,
        case_id: patientPrograms.case_id,
        program_id: programs.program_id,
        program_name: programs.program_name,
        description: programs.description,
        target_stage: programs.target_stage,
        session_per_day: programs.session_per_day,
        duration_sec: programs.duration_sec,
        assigned_date: patientPrograms.assigned_date,
        status: patientPrograms.status,
      })
      .from(patientPrograms)
      .innerJoin(programs, eq(patientPrograms.program_id, programs.program_id))
      .where(eq(patientPrograms.patient_id, patientId))
      .orderBy(desc(patientPrograms.assigned_date))

    return NextResponse.json(rows, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// POST /api/patient-programs → นักกายภาพมอบโปรแกรมให้ผู้ป่วยในเคสที่กำลังรักษา (แทนโปรแกรมเดิมของเคส)
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.THERAPIST)
    const body = await req.json()
    body.otId = viewer.ot_id
    if (!body.patientId || !body.programId || !body.otId) {
      return NextResponse.json({ error: 'ต้องระบุ patientId, programId และ otId' }, { status: 400, headers: cors })
    }
    const c = await openCaseOf(body.patientId)
    if (!c || c.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'ผู้ป่วยไม่มีเคสที่กำลังรักษา (ต้องผ่านการประเมินก่อน)' }, { status: 400, headers: cors })
    }

    const patientProgramId = await generateId(ID_PREFIX.PATIENT_PROGRAM, SEQUENCE.PATIENT_PROGRAM)
    await db.transaction(async (tx) => {
      await tx.update(patientPrograms)
        .set({ status: 'INACTIVE', end_date: new Date().toISOString().slice(0, 10) })
        .where(and(eq(patientPrograms.case_id, c.case_id), eq(patientPrograms.status, 'ACTIVE')))
      await tx.insert(patientPrograms).values({
        patient_program_id: patientProgramId,
        patient_id: body.patientId,
        case_id: c.case_id,
        program_id: body.programId,
        assigned_by: body.otId,
        status: 'ACTIVE',
      })
    })
    return NextResponse.json({ message: 'กำหนดโปรแกรมให้ผู้ป่วยสำเร็จ', patient_program_id: patientProgramId }, { status: 201, headers: cors })
  } catch (error) {
    const denied = authFail(error, cors)
    if (denied) return denied
    const e = dbError(error)
    return NextResponse.json({ error: e.error }, { status: e.status, headers: cors })
  }
}
