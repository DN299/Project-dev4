import jwt from 'jsonwebtoken'
import { NextResponse } from 'next/server'

// บทบาทในระบบ (ตาราง roles)
export const ROLE = { PATIENT: 'R001', THERAPIST: 'R002', RECORDS: 'R003' } as const
export type RoleId = (typeof ROLE)[keyof typeof ROLE]

/** ข้อมูลผู้ใช้ใน token ที่ /api/auth/login ออกให้ */
export interface Viewer {
  users_id: string
  role_id: RoleId
  ot_id: string | null
  patient_id: string | null
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) { super(message) }
}

/**
 * อ่านผู้ใช้จาก header Authorization: Bearer <token>
 * roles = บทบาทที่อนุญาต (ไม่ระบุ = ทุกบทบาทที่ล็อกอินแล้ว)
 * ข้อมูลในระบบเป็นข้อมูลสุขภาพ — ทุก API ต้องรู้ว่าใครเรียก และใช้ค่าจาก token แทนค่าที่ส่งมาใน body
 */
export function requireViewer(req: Request, ...roles: RoleId[]): Viewer {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('ไม่ได้ตั้งค่า JWT_SECRET')
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) throw new AuthError(401, 'กรุณาเข้าสู่ระบบ')
  let viewer: Viewer
  try {
    viewer = jwt.verify(token, secret) as Viewer
  } catch {
    throw new AuthError(401, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่')
  }
  if (roles.length && !roles.includes(viewer.role_id)) throw new AuthError(403, 'บทบาทของคุณไม่มีสิทธิ์ทำรายการนี้')
  return viewer
}

/** ผู้ป่วยเห็นได้เฉพาะข้อมูลของตัวเอง */
export function assertOwnPatient(viewer: Viewer, patientId: string | null | undefined) {
  if (viewer.role_id === ROLE.PATIENT && patientId !== viewer.patient_id) throw new AuthError(403, 'ดูได้เฉพาะข้อมูลของตัวเอง')
}

/** แปลง AuthError เป็นคำตอบ HTTP · คืน null ถ้าไม่ใช่ปัญหาสิทธิ์ */
export function authFail(error: unknown, headers: Record<string, string>) {
  return error instanceof AuthError ? NextResponse.json({ error: error.message }, { status: error.status, headers }) : null
}
