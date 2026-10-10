import type { TherapySession } from '../../types'

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export const fmtClock = (iso: string) =>
  new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'

export const fmtDuration = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** เซสชันของวันที่ระบุ เรียงจากเก่าไปใหม่ (ลำดับ = เซตที่ 1, 2, ...) */
export function sessionsOnDay(sessions: TherapySession[], day: Date): TherapySession[] {
  const key = dayKey(day)
  return sessions
    .filter(s => dayKey(new Date(s.session_date)) === key)
    .sort((a, b) => a.session_date.localeCompare(b.session_date))
}
