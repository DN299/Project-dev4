import { db } from "@/src/db";
import { devices } from "@/src/db/schema/devices";
import { and, eq, isNull, ne, or } from "drizzle-orm";
import { NextResponse } from "next/server";

const cors = {
  "Access-Control-Allow-Origin":
    process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors });
}

/**
 * POST /api/devices/claim  { deviceId, patientId }
 *
 * ผู้ป่วยกด "เชื่อมต่ออุปกรณ์" → ตั้ง holder_patient_id เป็นคนนี้
 * เชื่อมต่อได้เมื่อเครื่องไม่ได้กำลังนับให้ผู้ป่วยคนอื่นอยู่
 * เงื่อนไขอยู่ใน UPDATE เดียว จึงกันกรณีสองคนกดพร้อมกันได้
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { deviceId, patientId } = body ?? {};

    if (!deviceId || !patientId) {
      return NextResponse.json(
        { error: "ต้องระบุ deviceId และ patientId" },
        { status: 400, headers: cors },
      );
    }

    const updated = await db
      .update(devices)
      .set({ holder_patient_id: patientId })
      .where(
        and(
          eq(devices.device_id, deviceId),
          or(
            ne(devices.live_status, "RUNNING"),
            isNull(devices.holder_patient_id),
            eq(devices.holder_patient_id, patientId),
          ),
        ),
      )
      .returning({ device_id: devices.device_id });

    if (updated.length === 0) {
      return NextResponse.json(
        {
          error:
            "มีผู้ป่วยท่านอื่นกำลังฝึกอยู่ หากเครื่องค้าง กรุณาแจ้งนักกายภาพ",
        },
        { status: 409, headers: cors },
      );
    }

    return NextResponse.json({ message: "เชื่อมต่อแล้ว" }, { headers: cors });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.cause?.message ?? error.message },
      { status: 500, headers: cors },
    );
  }
}
