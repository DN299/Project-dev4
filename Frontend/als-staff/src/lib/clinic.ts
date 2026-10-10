import { API_BASE } from '../config'
import type { DiseaseStage, PatientAppointment } from '../types'

/* ===========================
   API
=========================== */

const SESSION_KEY = 'als-session'
const sessionToken = (): string | null => {
  try { return (JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as { token?: string } | null)?.token ?? null } catch { return null }
}

/** เรียก API พร้อม token ของผู้ใช้ — API ตรวจบทบาทและใช้ตัวตนจาก token เสมอ */
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = sessionToken()
  const headers: Record<string, string> = {}
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  // เซสชันหมดอายุ → กลับไปหน้าเข้าสู่ระบบ
  if (res.status === 401 && token && !path.startsWith('/api/auth/')) {
    localStorage.removeItem(SESSION_KEY)
    window.location.reload()
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? 'เชื่อมต่อระบบไม่สำเร็จ')
  return data as T
}

/** GET ที่คืนอาร์เรย์เสมอ (ผิดพลาด = อาร์เรย์ว่าง) */
export const list = <T,>(path: string): Promise<T[]> =>
  api<T[]>(path).then(d => (Array.isArray(d) ? d : [])).catch(() => [])

/* ===========================
   วันที่ภาษาไทย
=========================== */

export const DOW = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
export const DOWS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
export const MON = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export const MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
export const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86400000)
/** วันจันทร์ของสัปดาห์ */
export const mondayOf = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7))
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromIsoDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

/** "เสาร์ 3 ต.ค. 2569" */
export const thaiDate = (d: Date) => `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear() + 543}`
/** "3 ต.ค. 2569" */
export const thaiShort = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear() + 543}`
/** "3 ต.ค." */
export const dayMonth = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`
export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function ageFrom(birth?: string | null): number | null {
  if (!birth) return null
  const b = new Date(birth)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--
  return age
}

/* ===========================
   ช่องเวลา (กระดานมีเครื่องเดียว ใช้ร่วมกันทั้งศูนย์ · ช่องละ 1 ชั่วโมง · ปิดวันอาทิตย์)
   เปลี่ยนความยาวช่องที่ SLOT_MIN ให้ตรงกับ src/constants/slot.ts ฝั่ง backend
=========================== */

export const SLOT_MIN = 60
const SLOT_STARTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']
const addMin = (s: string, m: number) => { const [h, mm] = s.split(':').map(Number); const t = h * 60 + mm + m; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }
export const SLOTS: { s: string; e: string }[] = SLOT_STARTS.map(s => ({ s, e: addMin(s, SLOT_MIN) }))
/** ลำดับช่องแรกหลังพักกลางวัน (ใช้แทรกแถว "พักกลางวัน") */
export const LUNCH_BEFORE = SLOT_STARTS.indexOf('13:00')

export const isClosedDay = (d: Date) => d.getDay() === 0

export const slotDate = (day: Date, s: string) => {
  const [h, m] = s.split(':').map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
}
export const slotEnd = (s: string) => SLOTS.find(x => x.s === s)?.e ?? s
export const slotLabel = (s: string) => `${s} – ${slotEnd(s)}`

/** ช่องเวลาของนัด ("10:00") */
export const apptSlot = (a: PatientAppointment) => hhmm(new Date(a.appointment_date))
export const apptDay = (a: PatientAppointment) => startOfDay(new Date(a.appointment_date))

/** นัดที่ยังกันช่องเวลาอยู่ (ยกเลิก/ไม่มา ไม่กันช่อง) */
export const holdsSlot = (a: PatientAppointment) => !['CANCELLED', 'NO_SHOW'].includes(a.status)
export const isTraining = (a: PatientAppointment) => a.appointment_type !== 'ASSESSMENT'

/** นัดฝึก (ใช้กระดาน) ที่อยู่ในช่องนั้นของวันนั้น */
export const trainingAt = (appts: PatientAppointment[], day: Date, s: string) =>
  appts.find(a => isTraining(a) && holdsSlot(a) && sameDay(apptDay(a), day) && apptSlot(a) === s)

/** ช่วง from/to (ISO) สำหรับ GET /api/appointments */
export const rangeQuery = (from: Date, toExclusive: Date) =>
  `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(toExclusive.toISOString())}`

/* ===========================
   สถานะคิว
=========================== */

export type QueueState = 'done' | 'now' | 'called' | 'wait' | 'notyet' | 'booked' | 'noshow' | 'cancelled' | 'assess' | 'assessed'

export function queueState(a: PatientAppointment, today = new Date()): QueueState {
  if (a.appointment_type === 'ASSESSMENT') {
    if (a.status === 'COMPLETED') return 'assessed'
    if (a.status === 'CANCELLED') return 'cancelled'
    if (a.status === 'NO_SHOW') return 'noshow'
    return 'assess'
  }
  switch (a.status) {
    case 'COMPLETED': return 'done'
    case 'IN_PROGRESS': return 'now'
    case 'CHECKED_IN': return a.called_at ? 'called' : 'wait'
    case 'NO_SHOW': return 'noshow'
    case 'CANCELLED': return 'cancelled'
  }
  const diff = dayDiff(new Date(a.appointment_date), today)
  return diff < 0 ? 'noshow' : diff === 0 ? 'notyet' : 'booked'
}

/** [ข้อความ, พื้น, ตัวอักษร] — โทนเวชระเบียน/นักกายภาพ */
export const BADGE: Record<QueueState, [string, string, string]> = {
  done: ['เสร็จ', '#E4F5EC', '#145C38'],
  now: ['กำลังฝึก', '#E3EEF9', '#1F5573'],
  called: ['เรียกคิวแล้ว', '#E3EEF9', '#1F5573'],
  wait: ['มาแล้ว รอ', '#FFF0D9', '#8C420A'],
  notyet: ['ยังไม่มา', '#EEF1F6', '#4A5B6E'],
  booked: ['นัด', '#EDEEFC', '#3A40C9'],
  noshow: ['ไม่มา', '#FCEBEB', '#791F1F'],
  cancelled: ['ยกเลิก', '#EEF1F6', '#4A5B6E'],
  assess: ['รอประเมิน', '#FFF0D9', '#8C420A'],
  assessed: ['ประเมินแล้ว', '#E4F5EC', '#145C38'],
}

/* ===========================
   ระยะอาการ / ชื่อ
=========================== */

export const STAGES: DiseaseStage[] = ['EARLY', 'MIDDLE', 'LATE']
export const STAGE_LABEL: Record<DiseaseStage, string> = { EARLY: 'ระยะแรก', MIDDLE: 'ระยะกลาง', LATE: 'ระยะท้าย' }
export const stageLabel = (s?: string | null) => (s && s in STAGE_LABEL ? STAGE_LABEL[s as DiseaseStage] : 'ยังไม่ประเมิน')

export const fullName = (first?: string | null, last?: string | null) => `${(first ?? '').trim()} ${(last ?? '').trim()}`.trim() || '—'
/** "กภ. ณัฐ" */
export const ptName = (first?: string | null) => (first ? `กภ. ${first.trim()}` : '—')
/** อักษรย่อ 2 ตัวบนวงกลมโปรไฟล์ — พยัญชนะ 2 ตัวแรกของชื่อ ("ปิติ" → "ปต") */
export const initials = (first?: string | null) =>
  (first ?? '').replace(/[ะ-ฺเ-๎\s]/g, '').slice(0, 2) || '—'

/* ===========================
   เซตการฝึกของแต่ละนัด
=========================== */

/** เซตของนัดนั้น — ผูกด้วย appointment_id · เซตเก่าที่ยังไม่ผูกนัดใช้วันเดียวกันแทน · เรียงเซต 1, 2, ... */
export function setsOfVisit<T extends { session_id: string; session_date: string; appointment_id?: string | null }>(sessions: T[], a: PatientAppointment): T[] {
  const day = new Date(a.appointment_date)
  return sessions
    .filter(s => (s.appointment_id ? s.appointment_id === a.appointment_id : sameDay(new Date(s.session_date), day)))
    .sort((x, y) => x.session_date.localeCompare(y.session_date))
}

export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/* ===========================
   สถานะการเชื่อมต่อกระดาน (แอปผู้ป่วย) และสถานะการรักษา (หน้าติดตามการรักษา)
=========================== */

export type BoardLink = 'none' | 'waiting' | 'connected' | 'disconnected'
/** ยังไม่เชื่อมต่อ / รอเชื่อมต่อ (เวชระเบียนเรียกคิวแล้ว) / เชื่อมต่อแล้ว / ตัดการเชื่อมต่อแล้ว (จบการฝึก) */
export function boardLink(a?: PatientAppointment): BoardLink {
  if (!a) return 'none'
  if (a.status === 'IN_PROGRESS') return 'connected'
  if (a.status === 'COMPLETED' && isTraining(a)) return 'disconnected'
  if (a.status === 'CHECKED_IN' && a.called_at) return 'waiting'
  return 'none'
}
export const BOARD_LINK_LABEL: Record<BoardLink, string> = {
  none: 'ยังไม่เชื่อมต่อ', waiting: 'รอเชื่อมต่อ', connected: 'เชื่อมต่อกระดานแล้ว', disconnected: 'ตัดการเชื่อมต่อแล้ว',
}

export type FloorState = 'treating' | 'finished' | 'free'
/**
 * สถานะของกระดานวันนี้
 * - กำลังรักษาอยู่: มีคนฝึก หรือเรียกคิวแล้วรอนักกายภาพเชื่อมต่อ
 * - รักษาเสร็จแล้ว: คนล่าสุดเพิ่งจบภายในช่องเวลาเดียวกัน (SLOT_MIN นาที)
 * - คิวว่างแล้ว: ไม่มีใครใช้กระดาน
 */
export function floorState(todayTraining: PatientAppointment[], now = new Date()): FloorState {
  if (todayTraining.some(a => a.status === 'IN_PROGRESS' || (a.status === 'CHECKED_IN' && a.called_at))) return 'treating'
  const last = todayTraining.filter(a => a.status === 'COMPLETED').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0]
  return last?.completed_at && now.getTime() - new Date(last.completed_at).getTime() < SLOT_MIN * 60000 ? 'finished' : 'free'
}

/* ===========================
   บันทึก SOAP ฉบับปัจจุบัน (ฉบับเดิม + บันทึกแก้ไขล่าสุดของแต่ละช่อง)
=========================== */

export const SOAP_FIELDS = ['S', 'O', 'A', 'P'] as const
export type SoapField = (typeof SOAP_FIELDS)[number]
export const SOAP_LABEL: Record<SoapField, string> = {
  S: 'S · อาการที่ผู้ป่วยเล่า', O: 'O · สิ่งที่ตรวจวัดได้', A: 'A · การประเมินของนักกายภาพ', P: 'P · แผนและคำแนะนำ',
}

export function effectiveSoap(a: PatientAppointment, amendments: { appointment_id: string; field: string; new_value: string | null; amended_at: string }[]) {
  const out: Record<SoapField, string> = { S: a.soap_s ?? '', O: a.soap_o ?? '', A: a.soap_a ?? '', P: a.soap_p ?? '' }
  for (const m of [...amendments].filter(m => m.appointment_id === a.appointment_id).sort((x, y) => x.amended_at.localeCompare(y.amended_at))) {
    if ((SOAP_FIELDS as readonly string[]).includes(m.field)) out[m.field as SoapField] = m.new_value ?? ''
  }
  return out
}
