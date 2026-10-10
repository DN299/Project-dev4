import { db } from '@/src/db'
import { devices } from '@/src/db/schema/devices'
import { appointments } from '@/src/db/schema/appointments'
import { patients } from '@/src/db/schema/patients'
import { users } from '@/src/db/schema/users'
import { eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { hashDeviceKey, newDeviceKey } from '@/src/utils/device-key'
import { requireViewer, authFail, assertOwnPatient, ROLE } from '@/src/utils/auth'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

// GET /api/devices — คลังกระดาน + นัดที่เครื่องผูกอยู่ตอนนี้ (devices.current_appointment_id ซึ่ง trigger เขียน/ล้างให้)
export async function GET(req: Request) {
  try {
    const viewer = requireViewer(req)
    const deviceRows = await db.select().from(devices)

    const bound = deviceRows.map(d => d.current_appointment_id).filter((x): x is string => !!x)
    const holderRows = bound.length ? await db
      .select({
        appointment_id: appointments.appointment_id,
        patient_id: appointments.patient_id,
        first_name: users.first_name,
        last_name: users.last_name,
        started_at: appointments.started_at,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patient_id, patients.patient_id))
      .leftJoin(users, eq(patients.users_id, users.users_id))
      .where(inArray(appointments.appointment_id, bound)) : []
    const holderByAppt = new Map(holderRows.map(h => [h.appointment_id, h]))

    // อุปกรณ์ส่ง telemetry ทุกไม่กี่วินาที — ถ้าเงียบเกิน STALE_MS ถือว่าหลุดการเชื่อมต่อ (บอร์ดที่ดับไปจะไม่ได้แจ้งเอง)
    const STALE_MS = 20_000
    const now = Date.now()

    const result = deviceRows.map(d => {
      const holder = d.current_appointment_id ? holderByAppt.get(d.current_appointment_id) : undefined
      const online = d.connection_status === 'CONNECTED' && !!d.last_seen_at && now - d.last_seen_at.getTime() < STALE_MS
      return {
        device_id: d.device_id,
        device_name: d.device_name,
        serial_number: d.serial_number,
        status: d.status,
        connection_status: online ? 'CONNECTED' : 'DISCONNECTED',
        battery_level: d.battery_level,
        imu_status: d.imu_status,
        encoder_status: d.encoder_status,
        last_seen_at: d.last_seen_at,
        live_status: online ? d.live_status : 'IDLE',
        live_reps: online ? d.live_reps : null,
        voltage: d.voltage != null ? Number(d.voltage) : null,
        current_a: d.current_a != null ? Number(d.current_a) : null,
        holder_patient_id: holder?.patient_id ?? null,
        holder_name: holder ? `${holder.first_name ?? ''} ${holder.last_name ?? ''}`.trim() : null,
        current_appointment_id: d.current_appointment_id,
        issued_date: holder?.started_at ?? null,
      }
    })

    return NextResponse.json(result, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// POST /api/devices — เพิ่มอุปกรณ์ใหม่เข้าคลัง
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.RECORDS)
    const body = await req.json()
    if (!body.deviceName || !body.serialNumber) {
      return NextResponse.json({ error: 'ต้องระบุชื่ออุปกรณ์และหมายเลขซีเรียล' }, { status: 400, headers: cors })
    }

    const deviceId = `DEV${Date.now().toString().slice(-6)}`
    await db.insert(devices).values({
      device_id: deviceId,
      device_name: body.deviceName,
      serial_number: body.serialNumber,
      status: body.status || 'ACTIVE',
    })

    return NextResponse.json({ message: 'เพิ่มอุปกรณ์สำเร็จ', device_id: deviceId }, { status: 201, headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// PATCH /api/devices — แก้ไขข้อมูล/สถานะอุปกรณ์ · { deviceId, issueKey: true } ออกกุญแจใหม่ให้กระดาน (คืนกุญแจจริงครั้งเดียว)
export async function PATCH(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.RECORDS)
    const body = await req.json()
    if (!body.deviceId) {
      return NextResponse.json({ error: 'ต้องระบุ deviceId' }, { status: 400, headers: cors })
    }

    if (body.issueKey) {
      const key = newDeviceKey()
      const updated = await db.update(devices).set({ api_key: hashDeviceKey(key) }).where(eq(devices.device_id, body.deviceId)).returning({ id: devices.device_id })
      if (!updated.length) return NextResponse.json({ error: 'ไม่พบอุปกรณ์' }, { status: 404, headers: cors })
      return NextResponse.json({ message: 'ออกกุญแจใหม่แล้ว · ใส่ค่านี้ใน firmware (DEVICE_KEY) ระบบจะไม่แสดงซ้ำ', device_key: key }, { headers: cors })
    }

    const patch: Record<string, unknown> = {}
    if (body.deviceName !== undefined) patch.device_name = body.deviceName
    if (body.serialNumber !== undefined) patch.serial_number = body.serialNumber
    if (body.status !== undefined) patch.status = body.status
    if (body.connectionStatus !== undefined) patch.connection_status = body.connectionStatus
    if (body.batteryLevel !== undefined) patch.battery_level = body.batteryLevel
    if (body.imuStatus !== undefined) patch.imu_status = body.imuStatus
    if (body.encoderStatus !== undefined) patch.encoder_status = body.encoderStatus

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะแก้ไข' }, { status: 400, headers: cors })
    }

    await db.update(devices).set(patch).where(eq(devices.device_id, body.deviceId))

    return NextResponse.json({ message: 'แก้ไขอุปกรณ์สำเร็จ' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// DELETE /api/devices?device_id=DEV000001 — ลบอุปกรณ์ออกจากคลัง
export async function DELETE(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.RECORDS)
    const deviceId = new URL(req.url).searchParams.get('device_id')
    if (!deviceId) {
      return NextResponse.json({ error: 'ต้องระบุ device_id' }, { status: 400, headers: cors })
    }

    await db.delete(devices).where(eq(devices.device_id, deviceId))

    return NextResponse.json({ message: 'ลบอุปกรณ์สำเร็จ' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}
