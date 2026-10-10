import { db } from '@/src/db'
import { patients } from '@/src/db/schema/patients'
import { users } from '@/src/db/schema/users'
import { treatmentCases } from '@/src/db/schema/treatmentCases'
import { occupationalTherapists } from '@/src/db/schema/occupationalTherapist'
import { appointments } from '@/src/db/schema/appointments'
import { patientPrograms } from '@/src/db/schema/patientProgram'
import { devices } from '@/src/db/schema/devices'
import { soapAmendments } from '@/src/db/schema/soapAmendments'
import { TARGET_STAGE } from '@/src/constants/program'
import { generateId } from '@/src/utils/generate-id'
import { ID_PREFIX, SEQUENCE } from '@/src/constants/id-config'
import { dbError } from '@/src/utils/db-error'
import { requireViewer, authFail, ROLE } from '@/src/utils/auth'
import { openCaseOf, currentCaseOf } from '@/src/services/case.service'
import { eq, asc, and, desc, gte, inArray, isNotNull, notInArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { SLOT_MIN } from '@/src/constants/slot'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, PATCH, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

const VALID_STAGES = new Set(Object.values(TARGET_STAGE) as string[])

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: cors })

/**
 * GET /api/patients                       → ผู้ป่วยทั้งหมด
 * GET /api/patients?patient_id=PAT000001  → ผู้ป่วยคนเดียว
 * ข้อมูลประจำตัวมาจาก patients/users · ข้อมูลการรักษามาจากเคสปัจจุบัน (เคสที่ยังไม่ปิด หรือเคสที่ปิดล่าสุด)
 * น้ำหนักเป็นค่าที่เวชระเบียนบันทึกตอนรับเข้าคิวครั้งล่าสุด
 */
export async function GET(req: Request) {
  try {
    const viewer = requireViewer(req)
    // ผู้ป่วย (หรือผู้ดูแลที่ใช้บัญชีแทน) เห็นเฉพาะตัวเอง
    const patientId = viewer.role_id === ROLE.PATIENT ? viewer.patient_id : new URL(req.url).searchParams.get('patient_id')
    if (viewer.role_id === ROLE.PATIENT && !patientId) return NextResponse.json([], { headers: cors })

    const people = await db
      .select({
        patient_id: patients.patient_id,
        users_id: patients.users_id,
        first_name: users.first_name,
        last_name: users.last_name,
        phone: users.phone,
        email: users.email,
        birth_date: users.birth_date,
        gender: users.gender,
        register_date: patients.register_date,
        address: patients.address,
        caretaker_name: patients.caretaker_name,
        caretaker_phone: patients.caretaker_phone,
        caretaker_relation: patients.caretaker_relation,
        caretaker_can_use_app: patients.caretaker_can_use_app,
      })
      .from(patients)
      .innerJoin(users, eq(patients.users_id, users.users_id))
      .where(patientId ? eq(patients.patient_id, patientId) : undefined)
      .orderBy(asc(patients.register_date))
    if (people.length === 0) return NextResponse.json([], { headers: cors })

    const ids = people.map(p => p.patient_id)
    const [cases, ots, weights] = await Promise.all([
      db.select().from(treatmentCases).where(inArray(treatmentCases.patient_id, ids)).orderBy(desc(treatmentCases.opened_at)),
      db.select({ ot_id: occupationalTherapists.ot_id, first_name: users.first_name, last_name: users.last_name })
        .from(occupationalTherapists).innerJoin(users, eq(occupationalTherapists.users_id, users.users_id)),
      db.select({ patient_id: appointments.patient_id, weight_kg: appointments.weight_kg })
        .from(appointments)
        .where(and(inArray(appointments.patient_id, ids), isNotNull(appointments.weight_kg)))
        .orderBy(desc(appointments.appointment_date)),
    ])

    const otBy = new Map(ots.map(o => [o.ot_id, o]))
    const rows = people.map(p => {
      const mine = cases.filter(c => c.patient_id === p.patient_id)
      const c = mine.find(x => x.status !== 'CLOSED') ?? mine[0]
      const ot = c?.primary_ot_id ? otBy.get(c.primary_ot_id) : undefined
      const w = weights.find(x => x.patient_id === p.patient_id)
      return {
        ...p,
        weight: w?.weight_kg ?? null,
        case_id: c?.case_id ?? null,
        case_status: c?.status ?? null,
        case_count: mine.length,
        chief_complaint: c?.chief_complaint ?? null,
        pain_level: c?.pain_level ?? null,
        symptom_location: c?.symptom_location ?? null,
        onset_duration: c?.onset_duration ?? null,
        affected_side: c?.affected_side ?? null,
        start_stage: c?.start_stage ?? null,
        current_stage: c?.current_stage ?? null,
        assessment_note: c?.assessment_note ?? null,
        assessed_at: c?.assessed_at ?? null,
        primary_ot_id: c?.primary_ot_id ?? null,
        primary_ot_name: ot?.first_name ?? null,
        primary_ot_lastname: ot?.last_name ?? null,
        case_opened_at: c?.opened_at ?? null,
        case_closed_at: c?.closed_at ?? null,
        close_reason: c?.close_reason ?? null,
        close_stage: c?.close_stage ?? null,
        close_summary: c?.close_summary ?? null,
      }
    })
    return NextResponse.json(rows, { headers: cors })
  } catch (error: any) {
    return authFail(error, cors) ?? NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

/**
 * PATCH /api/patients — งานของนักกายภาพกับเคส
 * action ASSESS: ประเมินแรกรับ → เคส ACTIVE + มอบโปรแกรม + ปิดนัดประเมิน + ลงนัดฝึกครั้งแรก (ทรานแซกชันเดียว)
 *   { patientId, otId, usersId, stage, affectedSide, assessmentNote, programIds[], assessmentAppointmentId?, nextAppointmentDate }
 * action CLOSE_CASE: เสร็จสิ้นการรักษา — ยกเลิกนัดที่ค้าง { patientId, closeReason, closeStage, closeSummary }
 * action REOPEN_CASE: ยกเลิกการปิดเคสล่าสุด (ถ้ายังไม่มีเคสใหม่) { patientId }
 * action SET_STAGE: อัปเดตระยะอาการของเคส { patientId, stage }
 */
export async function PATCH(req: Request) {
  try {
    // การประเมิน ระยะอาการ และการปิดเคส เป็นงานของนักกายภาพเท่านั้น
    const viewer = requireViewer(req, ROLE.THERAPIST)
    const body = await req.json()
    body.otId = viewer.ot_id
    if (!body.patientId) return fail('ต้องระบุ patientId')

    if (body.action === 'ASSESS') {
      const c = await openCaseOf(body.patientId)
      if (!c) return fail('ผู้ป่วยไม่มีเคสที่รอประเมิน')
      if (!body.otId) return fail('ต้องระบุ otId')
      if (!VALID_STAGES.has(body.stage)) return fail('กรุณาระบุระยะอาการ')
      const programIds: string[] = Array.isArray(body.programIds) ? body.programIds.filter(Boolean) : []
      if (programIds.length === 0) return fail('เลือกโปรแกรมอย่างน้อย 1 รายการ')
      if (!body.nextAppointmentDate) return fail('เลือกช่องเวลานัดฝึกครั้งถัดไป')

      const [device] = await db.select({ device_id: devices.device_id }).from(devices)
        .where(eq(devices.status, 'ACTIVE')).orderBy(asc(devices.device_id)).limit(1)
      if (!device) return fail('ยังไม่มีกระดานที่ใช้งานได้')
      const nextId = await generateId(ID_PREFIX.APPOINTMENT, SEQUENCE.APPOINTMENT)
      const ppIds = await Promise.all(programIds.map(() => generateId(ID_PREFIX.PATIENT_PROGRAM, SEQUENCE.PATIENT_PROGRAM)))
      const today = new Date().toISOString().slice(0, 10)

      await db.transaction(async (tx) => {
        await tx.update(treatmentCases).set({
          status: 'ACTIVE',
          current_stage: body.stage,
          start_stage: c.start_stage ?? body.stage,
          affected_side: body.affectedSide || c.affected_side,
          assessment_note: body.assessmentNote || null,
          assessed_at: new Date(),
          primary_ot_id: c.primary_ot_id ?? body.otId,
        }).where(eq(treatmentCases.case_id, c.case_id))

        // โปรแกรมของเคสนี้ (เลือกได้หลายโปรแกรม) แทนชุดเดิม
        await tx.update(patientPrograms).set({ status: 'INACTIVE', end_date: today })
          .where(and(eq(patientPrograms.case_id, c.case_id), eq(patientPrograms.status, 'ACTIVE')))
        for (const [i, programId] of programIds.entries()) {
          await tx.insert(patientPrograms).values({
            patient_program_id: ppIds[i], patient_id: body.patientId, case_id: c.case_id,
            program_id: programId, assigned_by: body.otId, start_date: today, status: 'ACTIVE',
          })
        }

        if (body.assessmentAppointmentId) {
          await tx.update(appointments).set({ status: 'COMPLETED', treated_by: body.otId })
            .where(eq(appointments.appointment_id, body.assessmentAppointmentId))
        }

        await tx.insert(appointments).values({
          appointment_id: nextId,
          patient_id: body.patientId,
          case_id: c.case_id,
          ot_id: body.otId,
          created_by: viewer.users_id,
          device_id: device.device_id,
          appointment_date: new Date(body.nextAppointmentDate),
          duration_min: SLOT_MIN,
          appointment_type: 'TRAINING',
          status: 'SCHEDULED',
        })
      })
      return NextResponse.json({ message: 'บันทึกผลประเมินและนัดครั้งถัดไปสำเร็จ', appointment_id: nextId }, { headers: cors })
    }

    if (body.action === 'CLOSE_CASE') {
      const c = await openCaseOf(body.patientId)
      if (!c) return fail('ไม่มีเคสที่เปิดอยู่')
      if (c.primary_ot_id && c.primary_ot_id !== viewer.ot_id) return fail('ปิดเคสได้เฉพาะนักกายภาพประจำเคส', 403)
      if (!body.closeReason) return fail('ระบุเหตุผลที่จบการรักษา')
      if (body.closeStage && !VALID_STAGES.has(body.closeStage)) return fail('ระยะอาการไม่ถูกต้อง')
      await db.transaction(async (tx) => {
        await tx.update(treatmentCases).set({
          status: 'CLOSED',
          closed_at: new Date(),
          close_reason: body.closeReason,
          close_stage: body.closeStage || c.current_stage,
          close_summary: body.closeSummary || null,
        }).where(eq(treatmentCases.case_id, c.case_id))
        // ปิดเคสแล้วไม่มีนัดต่อ
        await tx.update(appointments).set({ status: 'CANCELLED' }).where(and(
          eq(appointments.case_id, c.case_id),
          notInArray(appointments.status, ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'IN_PROGRESS']),
          gte(appointments.appointment_date, new Date()),
        ))
      })
      return NextResponse.json({ message: 'ปิดเคสสำเร็จ' }, { headers: cors })
    }

    if (body.action === 'REOPEN_CASE') {
      if (await openCaseOf(body.patientId)) return fail('ผู้ป่วยมีเคสที่เปิดอยู่แล้ว')
      const c = await currentCaseOf(body.patientId)
      if (!c) return fail('ไม่พบเคส', 404)
      if (c.primary_ot_id && c.primary_ot_id !== viewer.ot_id) return fail('ยกเลิกการปิดเคสได้เฉพาะนักกายภาพประจำเคส', 403)
      await db.update(treatmentCases).set({ status: 'ACTIVE', closed_at: null, close_reason: null, close_stage: null, close_summary: null })
        .where(eq(treatmentCases.case_id, c.case_id))
      return NextResponse.json({ message: 'ยกเลิกการปิดเคสแล้ว' }, { headers: cors })
    }

    if (body.action === 'SET_STAGE') {
      if (!VALID_STAGES.has(body.stage)) return fail('ระยะอาการไม่ถูกต้อง')
      const c = await openCaseOf(body.patientId)
      if (!c) return fail('ไม่มีเคสที่เปิดอยู่')
      if (c.primary_ot_id && c.primary_ot_id !== viewer.ot_id) return fail('แก้ระยะอาการได้เฉพาะนักกายภาพประจำเคส', 403)
      await db.update(treatmentCases).set({ current_stage: body.stage }).where(eq(treatmentCases.case_id, c.case_id))
      return NextResponse.json({ message: 'อัปเดตระยะอาการแล้ว' }, { headers: cors })
    }

    return fail('action ไม่ถูกต้อง')
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    const e = dbError(error)
    return NextResponse.json({ error: e.error }, { status: e.status, headers: cors })
  }
}

// DELETE /api/patients?patient_id=PAT000001 → ลบผู้ป่วย (เคส/นัด/ผลการฝึกถูกลบตาม)
export async function DELETE(req: Request) {
  try {
    requireViewer(req, ROLE.RECORDS)
    const patientId = new URL(req.url).searchParams.get('patient_id')
    if (!patientId) return fail('ต้องระบุ patient_id')

    const [patient] = await db.select({ users_id: patients.users_id }).from(patients).where(eq(patients.patient_id, patientId))
    if (!patient) return fail('ไม่พบผู้ป่วย', 404)

    await db.transaction(async (tx) => {
      // treatment_cases ไม่ได้ cascade จาก patients — ต้องปลดนัด/โปรแกรมออกจากเคสก่อนลบเคส
      const caseIds = (await tx.select({ id: treatmentCases.case_id }).from(treatmentCases).where(eq(treatmentCases.patient_id, patientId))).map(c => c.id)
      const apptIds = (await tx.select({ id: appointments.appointment_id }).from(appointments).where(eq(appointments.patient_id, patientId))).map(a => a.id)
      if (apptIds.length) await tx.delete(soapAmendments).where(inArray(soapAmendments.appointment_id, apptIds))
      await tx.delete(appointments).where(eq(appointments.patient_id, patientId))
      await tx.delete(patientPrograms).where(eq(patientPrograms.patient_id, patientId))
      if (caseIds.length) await tx.delete(treatmentCases).where(inArray(treatmentCases.case_id, caseIds))
      await tx.delete(users).where(eq(users.users_id, patient.users_id))
    })
    return NextResponse.json({ message: 'ลบผู้ป่วยสำเร็จ' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    const e = dbError(error)
    return NextResponse.json({ error: e.error }, { status: e.status, headers: cors })
  }
}
