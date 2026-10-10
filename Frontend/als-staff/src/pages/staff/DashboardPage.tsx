import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, UserCheck, Users } from 'lucide-react'
import type { Patient, PatientAppointment } from '../../types'
import {
  list, rangeQuery, addDays, startOfDay, isoDate, fromIsoDate, thaiDate, mondayOf, sameDay,
  MON, MONTH, STAGES, STAGE_LABEL,
} from '../../lib/clinic'
import { Loading } from '../../components/ui'

const VISITED = ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED']
const STAGE_COLOR = { EARLY: '#4D53E0', MIDDLE: '#00A5FF', LATE: '#FFA100' } as const

type Bar = { v: number; l: string; cur: boolean; pick?: () => void }

export default function DashboardPage() {
  const today = startOfDay(new Date())
  const [from, setFrom] = useState(() => addDays(today, -29))
  const [to, setTo] = useState(today)
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

  // KPI ในช่วงที่เลือก
  // KPI: นัดวันนี้ และผู้ป่วยที่เข้ามาเดือนนี้ (นับคนไม่ซ้ำ)
  const todayAppts = appts.filter(a => sameDay(new Date(a.appointment_date), today) && a.status !== 'CANCELLED')
  const nDone = todayAppts.filter(a => a.status === 'COMPLETED').length
  const nNow = todayAppts.filter(a => a.status === 'IN_PROGRESS').length
  const thisMonth = appts.filter(a => { const d = new Date(a.appointment_date); return d >= thisMonthStart && d <= addDays(today, 1) && VISITED.includes(a.status) })
  const monthPatients = new Set(thisMonth.map(a => a.patient_id)).size
  const monthVisits = thisMonth.length

  // กราฟ
  let bars: Bar[] = []
  let unitText = '', periodLabel = ''
  const fmtR = (a: Date, b: Date) => a.getMonth() === b.getMonth()
    ? `${a.getDate()}–${b.getDate()} ${MON[b.getMonth()]} ${b.getFullYear() + 543}`
    : `${a.getDate()} ${MON[a.getMonth()]} – ${b.getDate()} ${MON[b.getMonth()]} ${b.getFullYear() + 543}`
  if (gran === 'week' && drill) {
    const L = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
    bars = L.map((l, i) => { const d = addDays(drill, i); return { v: d <= today ? visitsOn(d) : 0, l: `${l} ${d.getDate()}`, cur: sameDay(d, today) } })
    periodLabel = `สัปดาห์ ${fmtR(drill, addDays(drill, 6))}`
    unitText = 'แยกรายวัน · จำนวนครั้งที่มารับบริการ'
  } else if (gran === 'week') {
    for (let d = monthStart; d <= monthEnd;) {
      const wEnd = [addDays(d, 6 - ((d.getDay() + 6) % 7)), monthEnd].reduce((a, b) => (a < b ? a : b))
      const mon = mondayOf(d), a0 = d
      bars.push({ v: sumRange(d, wEnd), l: `${d.getDate()}–${wEnd.getDate()} ${MON[wEnd.getMonth()]}`, cur: a0 <= today && today <= wEnd, pick: () => setDrill(mon) })
      d = addDays(wEnd, 1)
    }
    periodLabel = `เดือน${MONTH[monthStart.getMonth()]} ${monthStart.getFullYear() + 543}`
    unitText = 'แยกรายสัปดาห์ · กดแท่งเพื่อดูรายวันของสัปดาห์นั้น'
  } else {
    for (let y = from.getFullYear(), m = from.getMonth(); y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth());) {
      const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
      const a = first < from ? from : first, b = last > to ? to : last
      const mo = (y - to.getFullYear()) * 12 + (m - to.getMonth())
      bars.push({ v: sumRange(a, b), l: `${MON[m]} ${String(y + 543).slice(2)}`, cur: y === today.getFullYear() && m === today.getMonth(), pick: () => { setGran('week'); setPv(mo); setDrill(null) } })
      m++; if (m > 11) { m = 0; y++ }
    }
    periodLabel = `${MON[from.getMonth()]} ${from.getFullYear() + 543} – ${MON[to.getMonth()]} ${to.getFullYear() + 543}`
    unitText = 'แยกรายเดือนตามช่วงวันที่ที่เลือก · กดแท่งเพื่อดูรายสัปดาห์'
  }
  const mx = Math.max(1, ...bars.map(b => b.v))
  const gridStyle = { gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))`, gap: bars.length > 5 ? 12 : 20 }

  // ระยะอาการ
  const staged = patients.filter(p => p.current_stage && p.current_stage in STAGE_LABEL)
  const pct = (s: string) => (staged.length ? Math.round((staged.filter(p => p.current_stage === s).length / staged.length) * 100) : 0)
  const top = staged.length ? STAGES.reduce((a, b) => (pct(b) > pct(a) ? b : a)) : null

  const tgl = (on: boolean) => `h-[34px] rounded-md px-4 text-[13px] font-semibold ${on ? 'bg-rx-accent text-white' : 'bg-transparent text-rx-muted'}`
  const dateCls = 'h-[38px] rounded-lg border border-rx-line bg-white px-2.5 text-[14px] text-rx-ink'

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[30px] font-semibold">แดชบอร์ด</h1>
          <span className="text-[14px] text-rx-muted">ภาพรวมศูนย์ · {thaiDate(from)} ถึง {thaiDate(to)}</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2">
          <CalendarDays size={18} className="text-rx-muted" />
          <label htmlFor="from" className="text-[13px] text-rx-muted">ตั้งแต่</label>
          <input id="from" type="date" className={dateCls} value={isoDate(from)} max={isoDate(to)} onChange={e => e.target.value && setFrom(fromIsoDate(e.target.value))} />
          <label htmlFor="to" className="text-[13px] text-rx-muted">ถึง</label>
          <input id="to" type="date" className={dateCls} value={isoDate(to)} min={isoDate(from)} max={isoDate(today)} onChange={e => { if (e.target.value) { setTo(fromIsoDate(e.target.value)); setPv(0); setDrill(null) } }} />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-6">
        {[
          { title: 'ผู้ป่วยทั้งหมด', value: `${patients.length} คน`, sub: `กำลังรักษา ${patients.filter(p => p.case_status === 'ACTIVE').length} · รอประเมิน ${patients.filter(p => p.case_status === 'PENDING_ASSESSMENT').length}`, icon: Users },
          { title: 'ผู้ป่วยที่เข้ามาเดือนนี้', value: `${monthPatients} คน`, sub: `มารับบริการ ${monthVisits} ครั้ง · ${MONTH[today.getMonth()]}`, icon: UserCheck },
          { title: 'นัดวันนี้', value: `${todayAppts.length} นัด`, sub: `เสร็จแล้ว ${nDone} · กำลังฝึก ${nNow}`, icon: CalendarDays, bar: todayAppts.length ? Math.round((nDone / todayAppts.length) * 100) : 0 },
        ].map(k => (
          <div key={k.title} className="flex min-w-0 flex-col gap-2 rounded-lg bg-white px-7 py-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[16px] font-semibold">{k.title}</span>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rx-tint text-rx-accent"><k.icon size={20} /></div>
            </div>
            <span className="text-[30px] font-semibold">{k.value}</span>
            <span className="text-[13px] text-rx-muted">{k.sub}</span>
            {k.bar !== undefined && (
              <div className="mt-1 h-1.5 rounded-full bg-rx-divider"><div className="h-1.5 rounded-full bg-[#43BC13]" style={{ width: `${k.bar}%` }} /></div>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-stretch gap-6">
        <div className="flex min-w-0 flex-[3_1_440px] flex-col gap-3.5 rounded-lg bg-white px-7 py-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-[20px] font-semibold">ผู้ป่วยที่เข้ามารับบริการ</span>
              <span className="text-[13px] text-rx-muted">{unitText}</span>
              {gran === 'week' && drill && (
                <button type="button" onClick={() => setDrill(null)} className="mt-1.5 h-8 self-start rounded-lg border border-rx-line bg-white px-3 text-[13px] font-semibold text-rx-accent">← กลับไปรายสัปดาห์ของเดือน</button>
              )}
              {gran === 'week' ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <button type="button" aria-label="ช่วงก่อนหน้า" onClick={() => (drill ? setDrill(addDays(drill, -7)) : setPv(pv - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rx-line bg-white">‹</button>
                  <span className="text-[15px] font-semibold text-rx-accent-deep">{periodLabel}</span>
                  <button type="button" aria-label="ช่วงถัดไป" onClick={() => (drill ? setDrill(addDays(drill, 7)) : setPv(pv + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rx-line bg-white">›</button>
                </div>
              ) : (
                <span className="mt-1.5 text-[15px] font-semibold text-rx-accent-deep">{periodLabel}</span>
              )}
            </div>
            <div className="flex gap-1 rounded-lg bg-rx-bg p-1">
              <button type="button" onClick={() => { setGran('week'); setPv(0); setDrill(null) }} className={tgl(gran === 'week')}>รายสัปดาห์</button>
              <button type="button" onClick={() => { setGran('month'); setDrill(null) }} className={tgl(gran === 'month')}>รายเดือน</button>
            </div>
          </div>
          <div className="grid h-[210px] items-end border-b border-rx-soft" style={gridStyle}>
            {bars.map((b, i) => (
              <button key={i} type="button" onClick={b.pick} disabled={!b.pick} aria-label={b.l} className="flex h-full min-w-0 flex-col items-center justify-end gap-1 border-none bg-transparent p-0 disabled:cursor-default">
                <span className="text-[11px] text-rx-muted">{b.v}</span>
                <div className="w-full rounded-t-md" style={{ height: Math.round((b.v / mx) * 170), background: b.cur ? '#4D53E0' : '#C9CBF6' }} />
              </button>
            ))}
          </div>
          <div className="grid text-center text-[11px] text-rx-muted" style={gridStyle}>
            {bars.map((b, i) => <span key={i} className="truncate whitespace-nowrap">{b.l}</span>)}
          </div>
        </div>

        <div className="flex min-w-0 flex-[2_1_280px] flex-col gap-[18px] rounded-lg bg-white px-7 py-6">
          <div className="flex flex-col">
            <span className="text-[20px] font-semibold">ผู้ป่วยแยกตามระยะอาการ</span>
            <span className="text-[13px] leading-relaxed text-rx-muted">จากผู้ป่วยทั้งหมด {patients.length} คน · ระยะที่ระบุตอนรับประวัติ</span>
          </div>
          {STAGES.map(s => (
            <div key={s} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[15px]">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_COLOR[s] }} />{STAGE_LABEL[s]}</span>
                <span className="font-semibold">{pct(s)}%</span>
              </div>
              <div className="h-2 rounded-full bg-rx-divider"><div className="h-2 rounded-full" style={{ width: `${pct(s)}%`, background: STAGE_COLOR[s] }} /></div>
            </div>
          ))}
          <div className="mt-1 rounded-lg bg-rx-bg px-3.5 py-3 text-[14px]">
            {top ? <>ผู้ป่วยส่วนใหญ่อยู่ <span className="font-semibold text-rx-accent">{STAGE_LABEL[top]}</span></> : 'ยังไม่มีผู้ป่วยที่ประเมินระยะ'}
          </div>
        </div>
      </div>
    </>
  )
}
