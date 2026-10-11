import { db } from "@/src/db";
import { devices } from "@/src/db/schema/devices";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const cors = {
  "Access-Control-Allow-Origin":
    process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const COMMANDS = ["START", "STOP"];
const SIDES = ["RIGHT", "LEFT"];

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors });
}

/**
 * POST /api/devices/command  { deviceId, patientId, command: "START" | "STOP", side?: "RIGHT" | "LEFT" }
 *
 * ฝากคำสั่งไว้ใน pending_command แล้วบอร์ดจะมารับเองตอน heartbeat ครั้งถัดไป
 * สั่งได้เฉพาะผู้ป่วยที่กด "เชื่อมต่อเครื่อง" ไว้ (holder_patient_id ตรงกัน)
 * ตอน START จดข้างแขนไว้ที่ current_side แล้ว device_save_session จะคัดลอกไปใส่ในผลเซต
 *
 * ไม่เขียน live_status / live_reps ที่นี่: ให้บอร์ดเป็นคนเขียนคนเดียว
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { deviceId, patientId, command, side } = body ?? {};

    if (!deviceId || !patientId || !COMMANDS.includes(command)) {
      return NextResponse.json(
        { error: "ต้องระบุ deviceId, patientId และ command (START | STOP)" },
        { status: 400, headers: cors },
      );
    }

    const update =
      command === "START"
        ? {
            pending_command: command,
            current_side: SIDES.includes(side) ? side : null,
          }
        : { pending_command: command };

    const updated = await db
      .update(devices)
      .set(update)
      .where(
        and(
          eq(devices.device_id, deviceId),
          eq(devices.holder_patient_id, patientId),
        ),
      )
      .returning({ device_id: devices.device_id });

    if (updated.length === 0) {
      return NextResponse.json(
        { error: "กรุณากดเชื่อมต่อเครื่องก่อน" },
        { status: 409, headers: cors },
      );
    }

    return NextResponse.json(
      { message: "ส่งคำสั่งแล้ว", command },
      { headers: cors },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.cause?.message ?? error.message },
      { status: 500, headers: cors },
    );
  }
}
