import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { patients } from '@/src/db/schema/patients'
import { treatmentCases } from '@/src/db/schema/treatmentCases'
import { appointments } from '@/src/db/schema/appointments'
import { generateId } from '@/src/utils/generate-id'
import { ID_PREFIX, SEQUENCE } from '@/src/constants/id-config'
import { DEFAULT_PASSWORD, hashPassword } from '@/src/utils/password'
import { dbError } from '@/src/utils/db-error'
import { requireViewer, authFail, ROLE } from '@/src/utils/auth'
import { openCaseOf, newCaseId } from '@/src/services/case.service'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { SLOT_MIN } from '@/src/constants/slot'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status, headers: cors })

const intake = (body: any) => {
  const pain = body.painLevel === undefined || body.painLevel === '' ? null : Number(body.painLevel)
  return {
    chief_complaint: body.chiefComplaint || null,
    pain_level: pain != null && !isNaN(pain) ? Math.max(0, Math.min(10, pain)) : null,
    symptom_location: body.symptomLocation || null,
    onset_duration: body.onsetDuration || null,
  }
}

/**
 * POST /api/register → เวชระเบียนรับผู้ป่วยใหม่ หรือเปิดคอร์สใหม่ให้ผู้ป่วยเก่าที่ปิดเคสไปแล้ว
 * - ผู้ป่วยใหม่: { firstName, lastName, phone, ..., ซักประวัติ, assessment: { otId, appointmentDate }, checkedInBy }
 * - ผู้ป่วยเก่า: { patientId, ซักประวัติ, assessment, checkedInBy }
 * สร้างเคส "รอประเมิน" + นัดประเมินวันนี้ที่รับเข้าคิวแล้ว (ไม่ใช้กระดาน) ในทรานแซกชันเดียว
 * ระยะของโรคไม่กรอกที่นี่ นักกายภาพเป็นผู้ประเมิน
 */
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.RECORDS)
    const body = await req.json()
    const assessment = body.assessment?.otId && body.assessment?.appointmentDate ? body.assessment : null
    if (!assessment) return fail('เลือกช่วงเวลาที่นักกายภาพว่างเพื่อนัดประเมินก่อน')

    const existing: string | null = body.patientId || null
    if (existing) {
      if (await openCaseOf(existing)) return fail('ผู้ป่วยมีเคสที่ยังไม่ปิดอยู่แล้ว')
    } else {
      if (!body.firstName || !body.lastName) return fail('ต้องระบุชื่อและนามสกุล')
      if (body.phone) {
        const [dup] = await db.select({ users_id: users.users_id }).from(users).where(eq(users.username, body.phone))
        if (dup) return fail('เบอร์โทรนี้มีผู้ใช้งานในระบบแล้ว กรุณาใช้เบอร์อื่น', 409)
      }
    }

    const usersId = existing ? null : await generateId(ID_PREFIX.USER, SEQUENCE.USER)
    const patientId = existing ?? await generateId(ID_PREFIX.PATIENT, SEQUENCE.PATIENT)
    const caseId = await newCaseId()
    const appointmentId = await generateId(ID_PREFIX.APPOINTMENT, SEQUENCE.APPOINTMENT)
    const passwordHash = existing ? null : await hashPassword(DEFAULT_PASSWORD)

    await db.transaction(async (tx) => {
      if (!existing) {
        await tx.insert(users).values({
          users_id: usersId!,
          role_id: 'R001',
          username: body.phone || usersId!,
          password: passwordHash!,
          first_name: body.firstName,
          last_name: body.lastName,
          phone: body.phone || null,
          birth_date: body.birthDate || null,
          gender: body.gender || null,
          status: 'ACTIVE',
        })
        await tx.insert(patients).values({
          patient_id: patientId,
          users_id: usersId!,
          address: body.address || null,
          caretaker_name: body.caretakerName || null,
          caretaker_phone: body.caretakerPhone || null,
          caretaker_relation: body.caretakerRelation || null,
          caretaker_can_use_app: body.caretakerCanUseApp ?? null,
        })
      }

      await tx.insert(treatmentCases).values({
        case_id: caseId,
        patient_id: patientId,
        primary_ot_id: assessment.otId,
        status: 'PENDING_ASSESSMENT',
        ...intake(body),
      })

      await tx.insert(appointments).values({
        appointment_id: appointmentId,
        patient_id: patientId,
        case_id: caseId,
        ot_id: assessment.otId,
        created_by: viewer.users_id,
        appointment_date: new Date(assessment.appointmentDate),
        duration_min: SLOT_MIN,
        appointment_type: 'ASSESSMENT',
        // ผู้ป่วยอยู่ที่ศูนย์แล้ว จึงรับเข้าคิวประเมินทันที (trigger อนุญาตเฉพาะนัดประเมินของวันนี้)
        status: 'CHECKED_IN',
        checked_in_by: viewer.users_id,
        symptoms_today: body.chiefComplaint || null,
        weight_kg: body.weight ? String(Number(body.weight)) : null,
      })
    })

    return NextResponse.json(
      { message: 'รับเรื่องสำเร็จ', patient_id: patientId, users_id: usersId, case_id: caseId, appointment_id: appointmentId },
      { status: 201, headers: cors }
    )
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    const e = dbError(error)
    return NextResponse.json({ error: e.error }, { status: e.status, headers: cors })
  }
}

/**
 * PATCH /api/register → แก้ข้อมูลทั่วไปของผู้ป่วย (เวชระเบียน)
 * { patientId, usersId, phone?, firstName?, ..., address?, caretaker*?, newPassword? }
 * ข้อมูลการรักษา (ระยะอาการ ผลประเมิน) แก้ที่นี่ไม่ได้ · น้ำหนักบันทึกต่อการมาแต่ละครั้งตอนรับเข้าคิว
 * primaryOtId → เปลี่ยนนักกายภาพประจำเคสที่เปิดอยู่
 */
export async function PATCH(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.RECORDS)
    const body = await req.json()
    if (!body.patientId || !body.usersId) return fail('ต้องระบุ patientId และ usersId')

    const userPatch: Record<string, unknown> = {}
    if (body.firstName !== undefined) userPatch.first_name = body.firstName
    if (body.lastName !== undefined) userPatch.last_name = body.lastName
    if (body.birthDate) userPatch.birth_date = body.birthDate
    if (body.gender !== undefined) userPatch.gender = body.gender || null
    if (body.phone !== undefined) userPatch.phone = body.phone || null
    if (body.email !== undefined) userPatch.email = body.email || null
    if (body.newPassword) userPatch.password = await hashPassword(body.newPassword)

    const patientPatch: Record<string, unknown> = {}
    if (body.address !== undefined) patientPatch.address = body.address || null
    if (body.caretakerName !== undefined) patientPatch.caretaker_name = body.caretakerName || null
    if (body.caretakerPhone !== undefined) patientPatch.caretaker_phone = body.caretakerPhone || null
    if (body.caretakerRelation !== undefined) patientPatch.caretaker_relation = body.caretakerRelation || null
    if (body.caretakerCanUseApp !== undefined) patientPatch.caretaker_can_use_app = body.caretakerCanUseApp

    // ผู้ดูแลเคส (นักกายภาพประจำเคส) ของเคสที่เปิดอยู่
    const openCase = body.primaryOtId !== undefined ? await openCaseOf(body.patientId) : null

    await db.transaction(async (tx) => {
      if (Object.keys(userPatch).length) await tx.update(users).set(userPatch).where(eq(users.users_id, body.usersId))
      if (Object.keys(patientPatch).length) await tx.update(patients).set(patientPatch).where(eq(patients.patient_id, body.patientId))
      if (openCase && body.primaryOtId) await tx.update(treatmentCases).set({ primary_ot_id: body.primaryOtId }).where(eq(treatmentCases.case_id, openCase.case_id))
    })
    return NextResponse.json({ message: 'บันทึกสำเร็จ' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    const e = dbError(error)
    return NextResponse.json({ error: e.error }, { status: e.status, headers: cors })
  }
}
