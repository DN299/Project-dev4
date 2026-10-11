import { db } from "@/src/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const cors = {
  "Access-Control-Allow-Origin":
    process.env.ALLOWED_ORIGIN || "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors });
}

/**
 * GET /api/skateboard-sessions?patient_id=...
 *
 * ผลเซตที่บอร์ดบันทึกไว้ของผู้ป่วยคนนี้ (ใหม่สุดก่อน)
 * ใช้ SQL ตรงๆ จึงไม่ต้องมีตารางนี้ใน Drizzle schema
 */
export async function GET(req: Request) {
  try {
    const patientId = new URL(req.url).searchParams.get("patient_id");
    if (!patientId) {
      return NextResponse.json([], { headers: cors });
    }

    const result: any = await db.execute(sql`
      select id, session_count, patient_id, side, created_at
      from skateboard_sessions
      where patient_id = ${patientId}
      order by created_at desc
      limit 100
    `);

    // postgres-js คืนเป็น array, node-postgres คืนเป็น { rows }
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    return NextResponse.json(rows, { headers: cors });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: cors },
    );
  }
}
