import { db } from "@/src/db";
import { devices } from "@/src/db/schema/devices";
import { appointments } from "@/src/db/schema/appointments";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  requireViewer,
  authFail,
  assertOwnPatient,
  ROLE,
} from "@/src/utils/auth";

const cors = {
  "Access-Control-Allow-Origin":
    process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  "Access-Control-Allow-Methods": "POST",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Device-Key",
};

const COMMANDS = ["START", "STOP"];
const SIDES = ["RIGHT", "LEFT"];

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors });
}

// POST /api/devices/command — ฝากคำสั่งไว้ให้กระดาน { deviceId, command: 'START' | 'STOP', side?: 'RIGHT' | 'LEFT' }
// กระดานรับคำสั่งตอนส่ง heartbeat ครั้งถัดไป (ภายใน 1 วินาที)
//
// ฝึกได้เฉพาะตอนเวชเรียกคิวแล้ว (กระดานผูกกับนัดที่กำลังฝึก: devices.current_appointment_id)
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.PATIENT, ROLE.THERAPIST);
    const body = await req.json();
    if (!body.deviceId || !COMMANDS.includes(body.command)) {
      return NextResponse.json(
        { error: "ต้องระบุ deviceId และ command (START | STOP)" },
        { status: 400, headers: cors },
      );
    }

    const [d] = await db
      .select({ appt: devices.current_appointment_id })
      .from(devices)
      .where(eq(devices.device_id, body.deviceId));
    if (!d) {
      return NextResponse.json(
        { error: "ไม่พบอุปกรณ์" },
        { status: 404, headers: cors },
      );
    }

    // ผู้ป่วยในนัดที่ผูกกับกระดานอยู่
    let owner: string | null = null;
    if (d.appt) {
      const [a] = await db
        .select({ p: appointments.patient_id })
        .from(appointments)
        .where(eq(appointments.appointment_id, d.appt));
      owner = a?.p ?? null;
    }

    // ผู้ป่วยสั่งได้เฉพาะกระดานที่ผูกกับตัวเอง
    if (viewer.role_id === ROLE.PATIENT) assertOwnPatient(viewer, owner);

    // เริ่มเซตได้เฉพาะตอนเวชเรียกคิวแล้ว
    if (body.command === "START" && !owner) {
      return NextResponse.json(
        { error: "รอเจ้าหน้าที่เรียกคิวก่อน" },
        { status: 409, headers: cors },
      );
    }

    await db
      .update(devices)
      .set(
        body.command === "START"
          ? // จดแขนที่ฝึกไว้ แล้วตอนบันทึกเซตจะคัดลอกไปใส่ผลเซต
            {
              pending_command: "START",
              current_side: SIDES.includes(body.side) ? body.side : null,
            }
          : { pending_command: "STOP" },
      )
      .where(eq(devices.device_id, body.deviceId));

    return NextResponse.json({ message: "ส่งคำสั่งแล้ว" }, { headers: cors });
  } catch (error: any) {
    const denied = authFail(error, cors);
    if (denied) return denied;
    return NextResponse.json(
      { error: error.cause?.message ?? error.message },
      { status: 500, headers: cors },
    );
  }
}
