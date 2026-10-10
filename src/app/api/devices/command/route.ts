import { db } from '@/src/db'
import { devices } from '@/src/db/schema/devices'
import { and, eq, isNotNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireViewer, authFail, assertOwnPatient, ROLE } from '@/src/utils/auth'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

const COMMANDS = ['START', 'STOP']

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

// POST /api/devices/command — ฝากคำสั่งไว้ให้กระดาน (ผู้ป่วยกดจบเซต = STOP) { deviceId, command: 'START' | 'STOP' }
// อุปกรณ์จะได้รับคำสั่งในคำตอบของ POST /api/devices/telemetry ครั้งถัดไป (ภายในไม่กี่วินาที)
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.PATIENT, ROLE.THERAPIST)
    const body = await req.json()
    if (!body.deviceId || !COMMANDS.includes(body.command)) {
      return NextResponse.json({ error: 'ต้องระบุ deviceId และ command (START | STOP)' }, { status: 400, headers: cors })
    }

    // ผู้ป่วยหยุดเซตได้ (เหนื่อย) เฉพาะกระดานที่ผูกกับนัดของตัวเอง · เริ่มเซตเป็นหน้าที่นักกายภาพ
    if (viewer.role_id === ROLE.PATIENT) {
      if (body.command !== 'STOP') return NextResponse.json({ error: 'ผู้ป่วยไม่ต้องกดเริ่มฝึกเอง นักกายภาพจะเริ่มเซตให้' }, { status: 403, headers: cors })
      const [d] = await db.select({ holder: devices.holder_patient_id }).from(devices).where(eq(devices.device_id, body.deviceId))
      assertOwnPatient(viewer, d?.holder)
    }

    const updated = await db
      .update(devices)
      .set({ pending_command: body.command })
      .where(body.command === 'START'
        // เริ่มเซตได้เฉพาะตอนกระดานผูกกับนัดที่กำลังฝึก (นักกายภาพเป็นผู้เชื่อมต่อ ผู้ป่วยไม่ต้องกดเริ่มเอง)
        ? and(eq(devices.device_id, body.deviceId), isNotNull(devices.current_appointment_id))
        : eq(devices.device_id, body.deviceId))
      .returning({ device_id: devices.device_id })
    if (updated.length === 0) {
      return NextResponse.json({ error: body.command === 'START' ? 'กระดานยังไม่ได้เชื่อมต่อกับนัดที่กำลังฝึก' : 'ไม่พบอุปกรณ์' }, { status: 404, headers: cors })
    }

    return NextResponse.json({ message: 'ส่งคำสั่งแล้ว' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}
