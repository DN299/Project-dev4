import { db } from '@/src/db'
import { programs } from '@/src/db/schema/program'
import { users } from '@/src/db/schema/users'
import { TARGET_STAGE } from '@/src/constants/program'
import { pgErrorCode } from '@/src/utils/db-error'
import { and, eq, or, countDistinct } from 'drizzle-orm'
import { patientPrograms } from '@/src/db/schema/patientProgram'
import { NextResponse } from 'next/server'
import { requireViewer, authFail, assertOwnPatient, ROLE } from '@/src/utils/auth'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

const VALID_STAGES = new Set(Object.values(TARGET_STAGE) as string[])

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

// GET /api/programs?created_by=USR000001&target_stage=EARLY
// created_by → โปรแกรมของนักกายภาพคนนั้น + โปรแกรมกลาง (SYSTEM) ที่ใช้ได้กับทุกคน · ไม่ระบุ = ทั้งหมด
// target_stage → กรองเฉพาะโปรแกรมที่ออกแบบสำหรับระยะอาการนั้น
export async function GET(req: Request) {
  try {
    const viewer = requireViewer(req)
    const url = new URL(req.url)
    const createdBy = url.searchParams.get('created_by')
    const targetStage = url.searchParams.get('target_stage')

    const scope = createdBy ? or(eq(programs.created_by, createdBy), eq(programs.program_type, 'SYSTEM')) : undefined
    const stageFilter = targetStage ? eq(programs.target_stage, targetStage) : undefined
    const where = scope && stageFilter ? and(scope, stageFilter) : scope ?? stageFilter

    const rows = where ? await db.select().from(programs).where(where) : await db.select().from(programs)

    // จำนวนผู้ป่วยที่ใช้โปรแกรมนี้อยู่ (ACTIVE)
    const usage = await db
      .select({ program_id: patientPrograms.program_id, n: countDistinct(patientPrograms.patient_id) })
      .from(patientPrograms)
      .where(eq(patientPrograms.status, 'ACTIVE'))
      .groupBy(patientPrograms.program_id)
    const usageBy = new Map(usage.map(u => [u.program_id, Number(u.n)]))

    return NextResponse.json(rows.map(r => ({ ...r, patient_count: usageBy.get(r.program_id) ?? 0 })), { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// POST /api/programs → สร้างโปรแกรมการฝึกใหม่ (ของนักกายภาพคนเดียว หรือโปรแกรมกลาง SYSTEM)
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.THERAPIST)
    const body = await req.json()
    body.usersId = viewer.users_id
    if (!body.programName || !body.usersId) {
      return NextResponse.json({ error: 'ต้องระบุชื่อโปรแกรมและผู้สร้าง' }, { status: 400, headers: cors })
    }
    if (!body.targetStage || !VALID_STAGES.has(body.targetStage)) {
      return NextResponse.json({ error: 'กรุณาระบุระยะอาการของโปรแกรม (ระยะแรก / ระยะกลาง / ระยะท้าย)' }, { status: 400, headers: cors })
    }

    const [creator] = await db.select({ role_id: users.role_id }).from(users).where(eq(users.users_id, body.usersId))
    if (!creator || creator.role_id !== 'R002') {
      return NextResponse.json({ error: 'เฉพาะนักกายภาพเท่านั้นที่สร้างโปรแกรมการฝึกได้ · เวชระเบียนดูคลังโปรแกรมได้อย่างเดียว' }, { status: 403, headers: cors })
    }

    const programId = `PRG${Date.now().toString().slice(-6)}`
    await db.insert(programs).values({
      program_id: programId,
      program_name: body.programName,
      description: body.description || null,
      program_type: body.programType === 'SYSTEM' ? 'SYSTEM' : 'CUSTOM',
      target_stage: body.targetStage || null,
      session_per_day: Number(body.sessionPerDay) || 1,
      created_by: body.usersId,
      duration_sec: Math.round((Number(body.durationMin) || 20) * 60),
    })

    return NextResponse.json({ message: 'สร้างโปรแกรมสำเร็จ', program_id: programId }, { status: 201, headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// PATCH /api/programs → แก้ไข/ปิด-เปิดใช้งานโปรแกรม (เฉพาะผู้สร้างโปรแกรมนั้น)
export async function PATCH(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.THERAPIST)
    const body = await req.json()
    body.usersId = viewer.users_id
    if (!body.programId || !body.usersId) {
      return NextResponse.json({ error: 'ต้องระบุ programId และ usersId' }, { status: 400, headers: cors })
    }
    if (body.targetStage !== undefined && body.targetStage && !VALID_STAGES.has(body.targetStage)) {
      return NextResponse.json({ error: 'ระยะอาการไม่ถูกต้อง' }, { status: 400, headers: cors })
    }

    const [existing] = await db.select({ created_by: programs.created_by }).from(programs).where(eq(programs.program_id, body.programId))
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบโปรแกรม' }, { status: 404, headers: cors })
    }
    if (existing.created_by !== body.usersId) {
      return NextResponse.json({ error: 'แก้ไขได้เฉพาะโปรแกรมที่คุณสร้างเท่านั้น' }, { status: 403, headers: cors })
    }

    const patch: Record<string, unknown> = {}
    if (body.status !== undefined) patch.status = body.status
    if (body.targetStage !== undefined) patch.target_stage = body.targetStage || null
    if (body.programName !== undefined) patch.program_name = body.programName
    if (body.description !== undefined) patch.description = body.description || null
    if (body.sessionPerDay !== undefined) patch.session_per_day = Number(body.sessionPerDay) || 1
    if (body.durationMin !== undefined) patch.duration_sec = Math.round((Number(body.durationMin) || 20) * 60)

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' }, { status: 400, headers: cors })
    }

    await db.update(programs).set(patch).where(eq(programs.program_id, body.programId))
    return NextResponse.json({ message: 'แก้ไขสำเร็จ' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// DELETE /api/programs?program_id=PRG000001&users_id=U004 → ลบโปรแกรม (เฉพาะผู้สร้างโปรแกรมนั้น)
export async function DELETE(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.THERAPIST)
    const url = new URL(req.url)
    const programId = url.searchParams.get('program_id')
    const usersId = viewer.users_id
    if (!programId || !usersId) {
      return NextResponse.json({ error: 'ต้องระบุ program_id และ users_id' }, { status: 400, headers: cors })
    }

    const [existing] = await db.select({ created_by: programs.created_by }).from(programs).where(eq(programs.program_id, programId))
    if (!existing) {
      return NextResponse.json({ error: 'ไม่พบโปรแกรม' }, { status: 404, headers: cors })
    }
    if (existing.created_by !== usersId) {
      return NextResponse.json({ error: 'ลบได้เฉพาะโปรแกรมที่คุณสร้างเท่านั้น' }, { status: 403, headers: cors })
    }

    await db.delete(programs).where(eq(programs.program_id, programId))
    return NextResponse.json({ message: 'ลบโปรแกรมสำเร็จ' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    if (pgErrorCode(error) === '23503') {
      return NextResponse.json({ error: 'ลบไม่ได้ เนื่องจากมีผู้ป่วยกำลังใช้งานโปรแกรมนี้อยู่ — ลองปิดใช้งานแทน' }, { status: 409, headers: cors })
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}
