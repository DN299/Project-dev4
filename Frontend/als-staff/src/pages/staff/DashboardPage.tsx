import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, UserCheck, Users } from 'lucide-react'
import type { Patient, PatientAppointment } from '../../types'
import {
  list, rangeQuery, addDays, startOfDay, isoDate, mondayOf, sameDay,
  MON, MONTH, STAGES, STAGE_LABEL,
} from '../../lib/clinic'
import { Loading } from '../../components/ui'

const VISITED = ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED']
const STAGE_COLOR = { EARLY: '#007AFF', MIDDLE: '#32ADE6', LATE: '#FF9500' } as const

type Bar = { v: number; l: string; cur: boolean; pick?: () => void }

export default function DashboardPage() {
  const today = startOfDay(new Date())
  // ช่วงข้อมูลของกราฟรายเดือน: 30 วันล่าสุดถึงวันนี้
  const from = addDays(today, -29)
  const to = today
  const [gran, setGran] = useState<'week' | 'month'>('week')
  const [pv, setPv] = useState(0) // เลื่อนเดือน (รายสัปดาห์)
  const [drill, setDrill] = useState<Date | null>(null) // วันจันทร์ของสัปดาห์ที่เจาะดู
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)

  // เดือนที่แสดงในโหมดรายสัปดาห์ (อิงจากวันสิ้นสุดของช่วงที่เลือก)
  const monthStart = new Date(to.getFullYear(), to.getMonth() + pv, 1)
  const monthEnd = new Date(to.getFullYear(), to.getMonth() + pv + 1, 0)
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const fetchFrom = [from, monthStart, thisMonthStart, drill ?? from].reduce((a, b) => (a < b ? a : b))
  const fetchTo = addDays([to, today, monthEnd, drill ? addDays(drill, 6) : to].reduce((a, b) => (a > b ? a : b)), 1)

  useEffect(() => {
    list<Patient>('/api/patients?status=ALL').then(setPatients)
  }, [])

  useEffect(() => {
    list<PatientAppointment>(`/api/appointments?${rangeQuery(fetchFrom, fetchTo)}`)
      .then(setAppts)
      .finally(() => setLoading(false))
  }, [fetchFrom.getTime(), fetchTo.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  const visitsOn = useMemo(() => {
    const byDay = new Map<string, number>()
    for (const a of appts) {
      if (!VISITED.includes(a.status)) continue
      const k = isoDate(new Date(a.appointment_date))
      byDay.set(k, (byDay.get(k) ?? 0) + 1)
    }
    return (d: Date) => byDay.get(isoDate(d)) ?? 0
  }, [appts])
  const sumRange = (a: Date, b: Date) => { let n = 0; for (let d = startOfDay(a); d <= b && d <= today; d = addDays(d, 1)) n += visitsOn(d); return n }

  if (loading) return <Loading />

  // KPI: นัดวันนี้
  const todayAppts = appts.filter(a => sameDay(new Date(a.appointment_date), today) && a.status !== 'CANCELLED')
  // ผู้ป่วยที่ลงทะเบียนเข้าศูนย์ใหม่ในเดือนนี้
  const newThisMonth = patients.filter(p => p.register_date && new Date(p.register_date) >= thisMonthStart).length

  // กราฟ
  let bars: Bar[] = []
  let periodLabel = ''
  const fmtR = (a: Date, b: Date) => a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MON[b.getMonth()]} ${b.getFullYear() + 543}`
    : `${a.getDate()} ${MON[a.getMonth()]} – ${b.getDate()} ${MON[b.getMonth()]} ${b.getFullYear() + 543}`
  if (gran === 'week' && drill) {
    const L = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
    bars = L.map((l, i) => { const d = addDays(drill, i); return { v: d <= today ? visitsOn(d) : 0, l: `${l} ${d.getDate()}`, cur: sameDay(d, today) } })
    periodLabel = `สัปดาห์ ${fmtR(drill, addDays(drill, 6))}`
  } else if (gran === 'week') {
    for (let d = monthStart; d <= monthEnd;) {
      const wEnd = [addDays(d, 6 - ((d.getDay() + 6) % 7)), monthEnd].reduce((a, b) => (a < b ? a : b))
      const mon = mondayOf(d), a0 = d
      bars.push({ v: sumRange(d, wEnd), l: `${d.getDate()}–${wEnd.getDate()} ${MON[wEnd.getMonth()]}`, cur: a0 <= today && today <= wEnd, pick: () => setDrill(mon) })
      d = addDays(wEnd, 1)
    }
    periodLabel = `เดือน${MONTH[monthStart.getMonth()]} ${monthStart.getFullYear() + 543}`
  } else {
    for (let y = from.getFullYear(), m = from.getMonth(); y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth());) {
      const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
      const a = first < from ? from : first, b = last > to ? to : last
      const mo = (y - to.getFullYear()) * 12 + (m - to.getMonth())
      bars.push({ v: sumRange(a, b), l: `${MON[m]} ${String(y + 543).slice(2)}`, cur: y === today.getFullYear() && m === today.getMonth(), pick: () => { setGran('week'); setPv(mo); setDrill(null) } })
      m++; if (m > 11) { m = 0; y++ }
    }
    periodLabel = `${MON[from.getMonth()]} ${from.getFullYear() + 543} – ${MON[to.getMonth()]} ${to.getFullYear() + 543}`
  }
  const mx = Math.max(1, ...bars.map(b => b.v))
  const gridStyle = { gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, gap: bars.length > 5 ? 12 : 20 }

  // ระยะอาการ
  const staged = patients.filter(p => p.current_stage && p.current_stage in STAGE_LABEL)
  const pct = (s: string) => (staged.length ? Math.round((staged.filter(p => p.current_stage === s).length / staged.length) * 100) : 0)
  // ระยะที่ % สูงสุด — ถ้า % เท่ากันแสดงทุกระยะที่เท่ากัน
  const maxPct = Math.max(...STAGES.map(pct))
  const top = staged.length ? STAGES.filter(s => pct(s) === maxPct) : []

  const tgl = (on: boolean) => `h-8 rounded-full px-4 text-[13px] text-rx-ink ${on ? 'bg-white font-semibold shadow-[0_2px_6px_rgba(0,0,0,0.10),0_1px_1px_rgba(0,0,0,0.04)]' : 'bg-transparent font-medium'}`
  const navBtn = 'flex h-7 w-7 items-center justify-center rounded-full text-rx-accent transition-colors hover:bg-white'
  const panel = 'flex min-w-0 flex-col rx-card'

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="m-0 text-[28px] font-bold leading-tight">แดชบอร์ด</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { title: 'ผู้ป่วยทั้งหมด', value: patients.length, unit: 'คน', icon: Users, tile: 'bg-[#007AFF]' },
          { title: 'ผู้ป่วยเพิ่มขึ้นเดือนนี้', value: newThisMonth, unit: 'คน', icon: UserCheck, tile: 'bg-[#34C759]' },
          { title: 'นัดวันนี้', value: todayAppts.length, unit: 'นัด', icon: CalendarDays, tile: 'bg-[#FF9500]' },
        ].map(k => (
          <div key={k.title} className={`${panel} flex-row items-start justify-between gap-3 px-5 py-4`}>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[14px] text-rx-muted">{k.title}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-[30px] font-bold leading-tight">{k.value}</span>
                <span className="text-[14px] text-rx-muted">{k.unit}</span>
              </span>
            </div>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-white ${k.tile}`}><k.icon size={19} /></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${panel} gap-5 px-6 py-5 lg:col-span-2`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[15px] font-semibold">ผู้ป่วยที่เข้ามารับบริการ</span>
              {gran === 'week' && drill && (
                <button type="button" onClick={() => setDrill(null)} className="h-8 self-start rounded-lg px-2 text-[13px] font-semibold text-rx-accent hover:bg-rx-tint">← กลับไปรายสัปดาห์ของเดือน</button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-full bg-rx-fill p-0.5">
                {gran === 'week' && <button type="button" aria-label="ช่วงก่อนหน้า" onClick={() => (drill ? setDrill(addDays(drill, -7)) : setPv(pv - 1))} className={navBtn}><ChevronLeft size={16} /></button>}
                <span className="px-2 text-[14px] font-semibold">{periodLabel}</span>
                {gran === 'week' && <button type="button" aria-label="ช่วงถัดไป" onClick={() => (drill ? setDrill(addDays(drill, 7)) : setPv(pv + 1))} className={navBtn}><ChevronRight size={16} /></button>}
              </div>
              <div className="flex gap-0.5 rounded-full bg-rx-fill p-0.5">
                <button type="button" onClick={() => { setGran('week'); setPv(0); setDrill(null) }} className={tgl(gran === 'week')}>รายสัปดาห์</button>
                <button type="button" onClick={() => { setGran('month'); setDrill(null) }} className={tgl(gran === 'month')}>รายเดือน</button>
              </div>
            </div>
          </div>
          <div className="grid h-52 items-end px-2" style={gridStyle}>
            {bars.map((b, i) => (
              <button key={i} type="button" onClick={b.pick} disabled={!b.pick} aria-label={b.l} className="group flex h-full min-w-0 flex-col items-center justify-end gap-2 border-none bg-transparent p-0 disabled:cursor-default">
                <span className={`text-[12px] ${b.cur ? 'font-semibold text-rx-ink' : 'text-rx-muted'}`}>{b.v}</span>
                <div
                  className={`w-full max-w-[44px] rounded-t-[8px] transition-colors ${b.cur ? 'bg-rx-accent' : 'bg-[#C7DFFF] group-enabled:group-hover:bg-rx-tint-2'}`}
                  style={{ height: Math.max(8, Math.round((b.v / mx) * 160)) }}
                />
              </button>
            ))}
          </div>
          <div className="-mt-2 grid border-t border-rx-divider px-2 pt-4 text-center text-[12px]" style={gridStyle}>
            {bars.map((b, i) => <span key={i} className={`truncate whitespace-nowrap ${b.cur ? 'font-semibold text-rx-ink' : 'text-rx-muted'}`}>{b.l}</span>)}
          </div>
        </div>

        {/* สัดส่วนผู้ป่วยแยกตามระยะอาการ: แถบสัดส่วนเส้นเดียว + รายการ */}
        <div className={`${panel} gap-5 px-6 py-5`}>
          <div className="flex flex-col items-start gap-2">
            <span className="text-[15px] font-semibold">ผู้ป่วยแยกตามระยะอาการ</span>
            {top.length > 0 && (
              <span className="rounded-full bg-rx-tint px-2.5 py-0.5 text-[12px] font-medium text-rx-accent">ส่วนใหญ่{top.map(s => STAGE_LABEL[s]).join(' และ ')}</span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[14px] font-semibold">สัดส่วนตามระยะ</span>
            <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-rx-soft">
              {STAGES.map(s => pct(s) > 0 && <div key={s} className="h-full" style={{ width: `${pct(s)}%`, background: STAGE_COLOR[s] }} />)}
            </div>
          </div>

          <ul className="m-0 flex list-none flex-col gap-3 p-0" role="list">
            {STAGES.map(s => (
              <li key={s} className="flex items-center justify-between border-b border-rx-divider px-1 py-2.5 last:border-b-0">
                <span className="flex items-center gap-3 text-rx-muted">
                  <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: STAGE_COLOR[s] }} />
                  {STAGE_LABEL[s]}
                </span>
                <span className="font-semibold">{pct(s)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
}
