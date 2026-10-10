import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { AuthUser, Patient, PatientAppointment, PatientProgram } from '../../types'
import { list, isTraining, sameDay, startOfDay, thaiShort, dayMonth, DOWS, stageLabel, ptName, fullName } from '../../lib/clinic'
import { Badge, Loading, Segmented } from '../../components/ui'

interface Props { user: AuthUser; onOpenCase: (patientId: string) => void }

const COLS = 'minmax(0,1.4fr) minmax(0,1.5fr) 150px 110px 120px'

export default function MyCasesPage({ user, onOpenCase }: Props) {
  const me = user.ot_id ?? ''
  const [patients, setPatients] = useState<Patient[]>([])
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [programs, setPrograms] = useState<Record<string, PatientProgram[]>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'a' | 'c'>('a')
  const [q, setQ] = useState('')

  useEffect(() => {
    Promise.all([list<Patient>('/api/patients?status=ALL'), list<PatientAppointment>('/api/appointments')])
      .then(async ([ps, as]) => {
        // เคสของฉัน = ผู้ป่วยที่ฉันเป็นนักกายภาพประจำเคส หรือเคยรักษา
        const mine = ps.filter(p => p.primary_ot_id === me || as.some(a => a.patient_id === p.patient_id && a.ot_id === me && !p.primary_ot_id))
        setPatients(mine); setAppts(as)
        const pp = await Promise.all(mine.map(p => list<PatientProgram>(`/api/patient-programs?patient_id=${p.patient_id}`)))
        setPrograms(Object.fromEntries(mine.map((p, i) => [p.patient_id, pp[i]])))
      })
      .finally(() => setLoading(false))
  }, [me])

  const today = startOfDay(new Date())
  const visitsOf = useMemo(() => (pid: string) => appts
    .filter(a => a.patient_id === pid && isTraining(a) && ['COMPLETED', 'IN_PROGRESS'].includes(a.status))
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date)), [appts])

  if (loading) return <Loading />

  const term = q.trim().toLowerCase()
  const match = (p: Patient) => !term || fullName(p.first_name, p.last_name).toLowerCase().includes(term) || p.patient_id.toLowerCase().includes(term)
  const progName = (pid: string, activeOnly: boolean) => {
    const ps = (programs[pid] ?? []).filter(p => !activeOnly || p.status === 'ACTIVE')
    return (activeOnly ? ps : ps.slice(0, 1)).map(p => p.program_name).join(', ') || '—'
  }
  const active = patients.filter(p => p.case_status !== 'CLOSED')
  const closed = patients.filter(p => p.case_status === 'CLOSED')
  const activeRows = active.filter(match).map(p => ({ p, v: visitsOf(p.patient_id) })).sort((a, b) => (b.v[0]?.appointment_date ?? '').localeCompare(a.v[0]?.appointment_date ?? ''))

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-[30px] font-semibold">เคสของฉัน</h1>
        <span className="text-[14px] text-rx-muted">{ptName(user.first_name)} · เรียงตามวันที่รักษาล่าสุด</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-11 max-w-[380px] flex-[1_1_280px] items-center gap-2.5 rounded-lg bg-white px-3.5">
          <Search size={18} className="text-rx-muted" />
          <label htmlFor="q" className="sr-only">ค้นหาเคส</label>
          <input id="q" value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อหรือ HN" className="min-w-0 flex-1 border-none bg-transparent text-[14px] outline-none" />
        </div>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'a', label: `กำลังรักษา (${active.length})` }, { value: 'c', label: `เสร็จสิ้นการรักษา (${closed.length})` }]} />
      </div>

      {tab === 'a' ? (
        <div className="overflow-x-auto rounded-lg bg-white">
          <div className="min-w-[760px]">
            <div className="grid items-center gap-2.5 px-5 py-3.5 text-[12px] uppercase tracking-[0.03em] text-rx-muted" style={{ gridTemplateColumns: COLS }}>
              <span>ผู้ป่วย</span><span>โปรแกรม</span><span>รักษาล่าสุด ↓</span><span>มาแล้ว</span><span />
            </div>
            {activeRows.length === 0 && <div className="border-t border-rx-divider px-5 py-4 text-[14px] text-rx-muted">ไม่พบเคส</div>}
            {activeRows.map(({ p, v }) => {
              const last = v[0] ? new Date(v[0].appointment_date) : null
              return (
                <div key={p.patient_id} className="grid items-center gap-2.5 border-t border-rx-divider px-5 py-3.5 text-[14px]" style={{ gridTemplateColumns: COLS }}>
                  <div className="flex min-w-0 flex-col"><span className="font-semibold">{fullName(p.first_name, p.last_name)}</span><span className="text-[12px] text-rx-muted">HN {p.patient_id} · {stageLabel(p.current_stage)}</span></div>
                  <span>{progName(p.patient_id, true)}</span>
                  <span className="font-semibold">{last ? (sameDay(last, today) ? 'วันนี้' : `${DOWS[last.getDay()]} ${dayMonth(last)}`) : '—'}</span>
                  <span className="text-rx-muted">{v.length} ครั้ง</span>
                  <button type="button" onClick={() => onOpenCase(p.patient_id)} className="inline-flex h-10 items-center justify-center rounded-lg border border-rx-line bg-white px-4 text-[13px] font-semibold">รายละเอียด</button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {closed.filter(match).length === 0 && <span className="text-[14px] text-rx-muted">ไม่พบเคส</span>}
          {closed.filter(match).map(p => {
            const v = visitsOf(p.patient_id)
            const first = v.length ? new Date(v[v.length - 1].appointment_date) : p.register_date ? new Date(p.register_date) : null
            const end = p.case_closed_at ? new Date(p.case_closed_at) : null
            const byPt = new Map<string, number>()
            for (const a of v) { const n = ptName(a.therapist_name); byPt.set(n, (byPt.get(n) ?? 0) + 1) }
            return (
              <div key={p.patient_id} className="flex flex-col gap-3 rounded-lg bg-white px-[22px] py-[18px]">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-col">
                    <span className="text-[16px] font-semibold">{fullName(p.first_name, p.last_name)} <span className="text-[13px] font-normal text-rx-muted">· HN {p.patient_id}</span></span>
                    <span className="text-[13px] text-rx-muted">รักษา {first ? thaiShort(first) : '—'} – {end ? thaiShort(end) : '—'} · มา {v.length} ครั้ง · {progName(p.patient_id, false)}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Badge label="เสร็จสิ้นการรักษา" />
                    <button type="button" onClick={() => onOpenCase(p.patient_id)} className="inline-flex h-10 items-center rounded-lg border border-rx-line bg-white px-4 text-[13px] font-semibold">รายละเอียด</button>
                  </div>
                </div>
                <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2 border-t border-rx-divider pt-2.5 text-[14px] leading-relaxed">
                  <span className="text-rx-muted">เหตุผลที่จบ</span><span>{p.close_reason ?? '—'}</span>
                  <span className="text-rx-muted">ระยะ เริ่ม → จบ</span><span>{stageLabel(p.start_stage ?? p.current_stage)} → {stageLabel(p.close_stage)}</span>
                  <span className="text-rx-muted">ผลการรักษา</span><span>{p.close_summary || '—'}</span>
                  <span className="text-rx-muted">ผู้รักษา</span><span>{[...byPt].map(([n, c]) => `${n} (${c})`).join(' · ') || '—'}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
