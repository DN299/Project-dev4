import { db } from '@/src/db'
import { devices } from '@/src/db/schema/devices'
import { appointments } from '@/src/db/schema/appointments'
import { patientPrograms } from '@/src/db/schema/patientProgram'
import { programs } from '@/src/db/schema/program'
import { therapySessions } from '@/src/db/schema/therapySession'
import { movementData } from '@/src/db/schema/movementData'
import { dbError } from '@/src/utils/db-error'
import { deviceKeyOk } from '@/src/utils/device-key'
import { eq, and, desc } from 'drizzle-orm'
import { NextResponse } from 'next/server'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

const num = (v: unknown) => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? undefined : Number(v))
const shortId = (p: string) => `${p}${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`.slice(0, 10)

/**
 * POST /api/devices/telemetry — กระดาน (ESP32) ส่งสถานะทุก 1–3 วินาที
 * header X-Device-Key: กุญแจของกระดาน (ฐานข้อมูลเก็บเป็น hash ใน devices.api_key)
 * body: { deviceId, state: 'IDLE' | 'RUNNING' | 'DONE', reps?, batteryLevel?, voltage?, current?, imuOk?,
 *         totalReps?, durationSec?, distanceCm? }   // ค่าสุดท้ายส่งมาตอน state = DONE (จบเซต)
 * ตอบกลับ: { command: 'START' | 'STOP' | null, bound, setDurationSec, sessionId? }
 *
 * บอร์ดไม่ต้องรู้ว่าวัดใคร: เครื่องผูกกับนัดผ่าน devices.current_appointment_id (trigger ตามสถานะนัด)
 * ถ้าเครื่องไม่ได้ผูกกับนัดที่กำลังฝึก ค่าจำนวนครั้งและผลเซตจะถูกปฏิเสธ — รับเฉพาะสถานะเครื่อง
 * ไม่มีเป้าหมายจำนวนครั้ง: เซตจบเมื่อครบเวลา หรือได้คำสั่ง STOP
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const deviceId: string | undefined = body.deviceId
    const state: string = body.state ?? 'IDLE'
    if (!deviceId || !['IDLE', 'RUNNING', 'DONE'].includes(state)) {
      return NextResponse.json({ error: 'ต้องระบุ deviceId และ state (IDLE | RUNNING | DONE)' }, { status: 400, headers: cors })
    }

    const result = await db.transaction(async (tx) => {
      const [device] = await tx.select({ pending_command: devices.pending_command, current_appointment_id: devices.current_appointment_id, api_key: devices.api_key })
        .from(devices).where(eq(devices.device_id, deviceId)).for('update')
      if (!device) return null
      if (!deviceKeyOk(device.api_key, req.headers.get('x-device-key'))) return 'BAD_KEY' as const

      // นัดที่ผูกอยู่ต้องกำลังฝึก และใช้โปรแกรมของเคสในนัดนั้น
      const [appt] = device.current_appointment_id ? await tx
        .select({ appointment_id: appointments.appointment_id, case_id: appointments.case_id, status: appointments.status })
        .from(appointments).where(eq(appointments.appointment_id, device.current_appointment_id)) : []
      const bound = appt?.status === 'IN_PROGRESS'
      const [program] = bound && appt.case_id ? await tx
        .select({ patient_program_id: patientPrograms.patient_program_id, duration_sec: programs.duration_sec, session_per_day: programs.session_per_day })
        .from(patientPrograms).innerJoin(programs, eq(patientPrograms.program_id, programs.program_id))
        .where(and(eq(patientPrograms.case_id, appt.case_id), eq(patientPrograms.status, 'ACTIVE')))
        .orderBy(desc(patientPrograms.assigned_date)).limit(1) : []

      const patch: Record<string, unknown> = {
        connection_status: 'CONNECTED',
        last_seen_at: new Date(),
        live_status: bound && state === 'RUNNING' ? 'RUNNING' : 'IDLE',
        live_reps: bound ? (state === 'RUNNING' ? num(body.reps) ?? 0 : undefined) : 0,
        pending_command: null,
      }
      if (patch.live_reps === undefined) delete patch.live_reps
      const battery = num(body.batteryLevel)
      if (battery !== undefined) patch.battery_level = Math.max(0, Math.min(100, Math.round(battery)))
      if (num(body.voltage) !== undefined) patch.voltage = num(body.voltage)!.toFixed(2)
      if (num(body.current) !== undefined) patch.current_a = num(body.current)!.toFixed(2)
      if (typeof body.imuOk === 'boolean') patch.imu_status = body.imuOk ? 'OK' : 'ERROR'
      await tx.update(devices).set(patch).where(eq(devices.device_id, deviceId))

      // จบเซต → หนึ่งแถวใน therapy_sessions (trigger session_guard นับลำดับเซต และตรวจว่านัดยังกำลังฝึก)
      let sessionId: string | null = null
      let rejected = false
      if (state === 'DONE') {
        if (!bound || !program) rejected = true
        else {
          const now = new Date()
          const totalReps = Math.max(0, Math.round(num(body.totalReps) ?? 0))
          sessionId = shortId('TS')
          await tx.insert(therapySessions).values({
            session_id: sessionId,
            patient_program_id: program.patient_program_id,
            appointment_id: appt.appointment_id,
            session_date: now,
            duration_sec: Math.max(0, Math.round(num(body.durationSec) ?? 0)),
            total_reps: totalReps,
            status: 'COMPLETED',
          })
          await tx.insert(movementData).values({
            movement_id: shortId('MV'),
            session_id: sessionId,
            device_id: deviceId,
            movement_count: totalReps,
            movement_distance: num(body.distanceCm) !== undefined ? num(body.distanceCm)!.toFixed(2) : null,
            recorded_at: now,
          })
        }
      }

      const setDurationSec = program ? Math.round(program.duration_sec / Math.max(1, program.session_per_day)) : 0
      // คำสั่ง START ใช้ได้เฉพาะตอนเครื่องผูกกับนัดที่กำลังฝึก
      const command = device.pending_command === 'START' && !bound ? null : device.pending_command
      return { command, bound, setDurationSec, sessionId, rejected }
    })

    if (result === 'BAD_KEY') {
      return NextResponse.json({ error: 'กุญแจของกระดานไม่ถูกต้อง' }, { status: 401, headers: cors })
    }
    if (!result) {
      return NextResponse.json({ error: `ไม่พบอุปกรณ์ ${deviceId} ในคลังอุปกรณ์` }, { status: 404, headers: cors })
    }
    if (result.rejected) {
      return NextResponse.json({ ...result, error: 'กระดานไม่ได้ผูกกับนัดที่กำลังฝึก ไม่บันทึกผลเซตนี้' }, { status: 409, headers: cors })
    }
    return NextResponse.json(result, { headers: cors })
  } catch (error) {
    const e = dbError(error)
    return NextResponse.json({ error: e.error }, { status: e.status, headers: cors })
  }
}
