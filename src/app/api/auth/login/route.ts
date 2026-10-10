import { db } from '@/src/db'
import { users } from '@/src/db/schema/users'
import { roles } from '@/src/db/schema/roles'
import { occupationalTherapists } from '@/src/db/schema/occupationalTherapist'
import { patients } from '@/src/db/schema/patients'
import { verifyPassword } from '@/src/utils/password'
import { eq, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const cors = {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Device-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: cors })
}

// POST /api/auth/login → เข้าสู่ระบบด้วย username/password คืนค่า JWT + ข้อมูลผู้ใช้
export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.username || !body.password) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' }, { status: 400, headers: cors })
    }

    const [row] = await db
      .select({
        users_id: users.users_id,
        username: users.username,
        password: users.password,
        first_name: users.first_name,
        last_name: users.last_name,
        role_id: users.role_id,
        role_name: roles.role_name,
        status: users.status,
      })
      .from(users)
      .innerJoin(roles, eq(users.role_id, roles.role_id))
      .where(or(eq(users.username, body.username), eq(users.email, body.username)))

    if (!row || !(await verifyPassword(body.password, row.password))) {
      return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401, headers: cors })
    }

    if (row.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' }, { status: 403, headers: cors })
    }

    let otId: string | null = null
    if (row.role_id === 'R002') {
      const [ot] = await db
        .select({ ot_id: occupationalTherapists.ot_id })
        .from(occupationalTherapists)
        .where(eq(occupationalTherapists.users_id, row.users_id))
      otId = ot?.ot_id ?? null
    }

    let patientId: string | null = null
    if (row.role_id === 'R001') {
      const [p] = await db
        .select({ patient_id: patients.patient_id })
        .from(patients)
        .where(eq(patients.users_id, row.users_id))
      patientId = p?.patient_id ?? null
    }

    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('ไม่ได้ตั้งค่า JWT_SECRET')

    const token = jwt.sign(
      { users_id: row.users_id, role_id: row.role_id, ot_id: otId, patient_id: patientId },
      secret,
      { expiresIn: '8h' }
    )

    return NextResponse.json({
      token,
      user: {
        users_id: row.users_id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        role_id: row.role_id,
        role_name: row.role_name,
        ot_id: otId,
        patient_id: patientId,
      },
    }, { headers: cors })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors })
  }
}
