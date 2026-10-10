import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { occupationalTherapists } from '@/src/db/schema/occupationalTherapist'
import { treatmentCases } from '@/src/db/schema/treatmentCases'
import { NextResponse } from 'next/server'
import { requireViewer, authFail, assertOwnPatient, ROLE } from '@/src/utils/auth'
import { and, eq, ne, countDistinct } from 'drizzle-orm'
import { DEFAULT_PASSWORD, hashPassword } from '@/src/utils/password'
import { pgErrorCode } from '@/src/utils/db-error'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

// GET /api/therapists — ดึงรายชื่อนักกายภาพ + จำนวนเคส
export async function GET(req: Request) {
  try {
    const viewer = requireViewer(req)
    const result = await db
      .select({
        ot_id: occupationalTherapists.ot_id,
        users_id: occupationalTherapists.users_id,
        license_number: occupationalTherapists.license_number,
        first_name: users.first_name,
        last_name: users.last_name,
        phone: users.phone,
        cases: countDistinct(treatmentCases.case_id),
      })
      .from(occupationalTherapists)
      .innerJoin(users, eq(occupationalTherapists.users_id, users.users_id))
      // จำนวนเคสที่ยังไม่ปิดที่เป็นนักกายภาพประจำเคส
      .leftJoin(treatmentCases, and(eq(treatmentCases.primary_ot_id, occupationalTherapists.ot_id), ne(treatmentCases.status, 'CLOSED')))
      .groupBy(occupationalTherapists.ot_id, users.users_id)

    return NextResponse.json(result, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    if (pgErrorCode(error) === '23505') {
      return NextResponse.json({ error: 'ข้อมูลนี้ซ้ำกับที่มีอยู่ในระบบแล้ว (เช่น เบอร์โทรหรืออีเมล)' }, { status: 409, headers: cors })
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// POST /api/therapists — เพิ่มนักกายภาพใหม่
export async function POST(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.RECORDS)
    const body = await req.json()
    const timestamp = Date.now().toString().slice(-6)
    const usersId = `U${timestamp}`
    const otId = `OT${timestamp}`

    if (body.phone) {
      const [existing] = await db.select({ users_id: users.users_id }).from(users).where(eq(users.username, body.phone))
      if (existing) {
        return NextResponse.json({ error: 'เบอร์โทรนี้มีผู้ใช้งานในระบบแล้ว กรุณาใช้เบอร์อื่น' }, { status: 409, headers: cors })
      }
    }

    // สร้าง user (role R002 = นักกิจกรรมบำบัด)
    await db.insert(users).values({
      users_id: usersId,
      role_id: 'R002',
      username: body.phone || `ot${timestamp}`,
      password: await hashPassword(DEFAULT_PASSWORD),
      first_name: body.firstName,
      last_name: body.lastName,
      phone: body.phone || null,
      email: body.email || null,
      gender: body.gender || null,
      birth_date: body.birthDate || null,
      status: 'ACTIVE',
    })

    // สร้าง occupational therapist
    await db.insert(occupationalTherapists).values({
      ot_id: otId,
      users_id: usersId,
      license_number: body.licenseNumber,
    })

    return NextResponse.json({
      message: 'เพิ่มนักกายภาพสำเร็จ',
      ot_id: otId,
      users_id: usersId,
    }, { status: 201, headers: cors })

  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    if (pgErrorCode(error) === '23505') {
      return NextResponse.json({ error: 'ข้อมูลนี้ซ้ำกับที่มีอยู่ในระบบแล้ว (เช่น เบอร์โทรหรืออีเมล)' }, { status: 409, headers: cors })
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// PATCH /api/therapists — แก้ไขข้อมูลนักกายภาพ
export async function PATCH(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.RECORDS)
    const body = await req.json()
    if (!body.otId || !body.usersId) {
      return NextResponse.json({ error: 'ต้องระบุ otId และ usersId' }, { status: 400, headers: cors })
    }

    const userPatch: Record<string, unknown> = {}
    if (body.firstName !== undefined) userPatch.first_name = body.firstName
    if (body.lastName !== undefined) userPatch.last_name = body.lastName
    if (body.phone !== undefined) userPatch.phone = body.phone || null
    if (body.email !== undefined) userPatch.email = body.email || null
    if (body.gender !== undefined) userPatch.gender = body.gender || null
    if (body.newPassword) userPatch.password = await hashPassword(body.newPassword)
    if (Object.keys(userPatch).length > 0) {
      await db.update(users).set(userPatch).where(eq(users.users_id, body.usersId))
    }

    if (body.licenseNumber !== undefined) {
      await db
        .update(occupationalTherapists)
        .set({ license_number: body.licenseNumber })
        .where(eq(occupationalTherapists.ot_id, body.otId))
    }

    return NextResponse.json({ message: 'แก้ไขข้อมูลนักกายภาพสำเร็จ' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    if (pgErrorCode(error) === '23505') {
      return NextResponse.json({ error: 'ข้อมูลนี้ซ้ำกับที่มีอยู่ในระบบแล้ว (เช่น เบอร์โทรหรืออีเมล)' }, { status: 409, headers: cors })
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}

// DELETE /api/therapists?ot_id=OT000001 → ลบนักกายภาพ (ลบ users ต้นทาง cascade ไปที่ occupational_therapists)
export async function DELETE(req: Request) {
  try {
    const viewer = requireViewer(req, ROLE.RECORDS)
    const otId = new URL(req.url).searchParams.get('ot_id')
    if (!otId) {
      return NextResponse.json({ error: 'ต้องระบุ ot_id' }, { status: 400, headers: cors })
    }

    const [therapist] = await db
      .select({ users_id: occupationalTherapists.users_id })
      .from(occupationalTherapists)
      .where(eq(occupationalTherapists.ot_id, otId))
    if (!therapist) {
      return NextResponse.json({ error: 'ไม่พบนักกายภาพ' }, { status: 404, headers: cors })
    }

    await db.delete(users).where(eq(users.users_id, therapist.users_id))

    return NextResponse.json({ message: 'ลบนักกายภาพสำเร็จ' }, { headers: cors })
  } catch (error: any) {
    const denied = authFail(error, cors)
    if (denied) return denied
    if (pgErrorCode(error) === '23505') {
      return NextResponse.json({ error: 'ข้อมูลนี้ซ้ำกับที่มีอยู่ในระบบแล้ว (เช่น เบอร์โทรหรืออีเมล)' }, { status: 409, headers: cors })
    }
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}