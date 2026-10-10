import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TherapySession, PatientProgram } from '../../types'
import { list, addDays, mondayOf, sameDay, dayMonth, thaiShort, DOWS } from '../../lib/clinic'
import { fmtClock, fmtDuration, sessionsOnDay } from './patientUtils'

interface Props { patientId: string }

const WEEKDAY_MON_FIRST = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

export default function PatientStatsPage({ patientId }: Props) {
  const [sessions, setSessions] = useState<TherapySession[]>([])
  const [programs, setPrograms] = useState<PatientProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [wk, setWk] = useState(0)

  useEffect(() => {
    Promise.all([
      list<TherapySession>(`/api/sessions?patient_id=${patientId}`).then(setSessions),
      list<PatientProgram>(`/api/patient-programs?patient_id=${patientId}`).then(setPrograms),
    ]).finally(() => setLoading(false))
  }, [patientId])

  if (loading) return <div className="py-16 text-center text-[13px] text-pt-muted">กำลังโหลด...</div>

  const now = new Date()
  const mon = addDays(mondayOf(now), wk * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  const perDay = days.map(d => sessionsOnDay(sessions, d))
  const reps = perDay.map(ss => ss.reduce((s, x) => s + x.total_reps, 0))
  const total = reps.reduce((a, b) => a + b, 0)
  const nSets = perDay.reduce((a, ss) => a + ss.length, 0)
  const mx = Math.max(1, ...reps)
  const rows = days.flatMap((d, i) => perDay[i].map((s, k) => ({ d, s, set: k + 1 }))).reverse()

  const firstDay = [...sessions.map(s => s.session_date), ...programs.map(p => p.assigned_date)].filter(Boolean).sort()[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col">
        <span className="text-[21px] font-bold">ผลการฝึก</span>
        <span className="text-[13px] text-pt-muted">ดูย้อนหลังได้ทีละสัปดาห์</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="สัปดาห์ก่อน" onClick={() => setWk(wk - 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E4E0EC] bg-white"><ChevronLeft size={18} /></button>
        <span className="flex-1 text-center text-[14px] font-semibold">{wk === 0 ? 'สัปดาห์นี้ · ' : ''}{dayMonth(mon)} – {dayMonth(days[6])}</span>
        <button type="button" aria-label="สัปดาห์ถัดไป" disabled={wk >= 0} onClick={() => setWk(Math.min(0, wk + 1))} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E4E0EC] bg-white disabled:opacity-40"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-3.5 py-3"><span className="text-[12px] text-pt-muted">จำนวนครั้งรวม</span><span className="text-[22px] font-bold">{total.toLocaleString()} ครั้ง</span></div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-3.5 py-3"><span className="text-[12px] text-pt-muted">เซตที่ทำ</span><span className="text-[22px] font-bold">{nSets} เซต</span></div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-[18px] bg-white p-4">
        <span className="text-[14px] font-semibold">จำนวนครั้งต่อวัน</span>
        <div className="grid h-[110px] grid-cols-7 items-end gap-2 border-b border-pt-line">
          {reps.map((n, i) => {
            const isToday = sameDay(days[i], now)
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[11px] text-pt-muted">{n || ''}</span>
                <div className={`w-full rounded-t-md ${isToday ? 'bg-pt-accent' : 'bg-[#EBC3AE]'}`} style={{ height: Math.round((n / mx) * 88) }} />
              </div>
            )
          })}
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-[12px] text-pt-muted">
          {WEEKDAY_MON_FIRST.map((w, i) => <span key={w} className={sameDay(days[i], now) ? 'font-bold text-pt-ink' : ''}>{w}</span>)}
        </div>
      </div>

      {rows.map(({ d, s, set }) => (
        <div key={s.session_id} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pt-tint text-[15px] font-bold text-pt-accent-ink">{set}</div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-semibold">ทำได้ {s.total_reps} ครั้ง</span>
            <span className="text-[12px] text-pt-muted">{DOWS[d.getDay()]} {dayMonth(d)} · {fmtDuration(s.duration_sec)} นาที · จบ {fmtClock(s.session_date)}</span>
          </div>
          <span className="rounded-full bg-[#E4F5EC] px-2.5 py-1 text-[12px] font-semibold text-[#145C38]">บันทึกแล้ว</span>
        </div>
      ))}

      {rows.length === 0 && (
        <div className="flex flex-col gap-1 rounded-2xl bg-white px-4 py-[18px]">
          <span className="text-[15px] font-semibold">ยังไม่มีการฝึกในสัปดาห์นี้</span>
          {firstDay && <span className="text-[13px] text-pt-muted">คอร์สของคุณเริ่มวันที่ {thaiShort(new Date(firstDay))}</span>}
        </div>
      )}
    </div>
  )
}
