import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { AuthUser, Patient, PatientAppointment, PatientProgram } from '../../types'
import { list, isTraining, stageLabel, ptName, fullName } from '../../lib/clinic'
import { Btn, Loading } from '../../components/ui'

interface Props { user: AuthUser; onOpenCase: (patientId: string) => void }


export default function MyCasesPage({ user, onOpenCase }: Props) {
  const me = user.ot_id ?? ''
  const [patients, setPatients] = useState<Patient[]>([])
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [programs, setPrograms] = useState<Record<string, PatientProgram[]>>({})
  const [loading, setLoading] = useState(true)
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
  const rows = patients.filter(match).map(p => ({ p, v: visitsOf(p.patient_id) })).sort((a, b) => (b.v[0]?.appointment_date ?? '').localeCompare(a.v[0]?.appointment_date ?? ''))

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-[28px] font-bold leading-tight">เคสของฉัน</h1>
          <span className="text-[13px] text-rx-muted">{ptName(user.first_name)} · เรียงตามวันที่รักษาล่าสุด</span>
        </div>
        <div className="group flex h-10 min-w-[260px] flex-[0_1_380px] items-center gap-3 rounded-field border border-[#C7C7CC] bg-white px-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-colors focus-within:border-rx-accent focus-within:ring-4 focus-within:ring-rx-accent/15">
          <Search size={17} className="text-rx-muted" />
          <label htmlFor="q" className="sr-only">ค้นหาเคส</label>
          <input id="q" value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อหรือ HN" className="min-w-0 flex-1 border-none bg-transparent text-[15px] outline-none placeholder:text-rx-muted" />
        </div>
      </div>

      {/* รายการเคสแบบการ์ดกระจกแยกคนละใบ */}
      <div className="flex flex-col gap-3">
        {rows.length === 0 && <div className="rx-card px-5 py-4 text-[15px] text-rx-muted">ไม่พบเคส</div>}
        {rows.map(({ p }) => (
          <div key={p.patient_id} className="rx-card rx-lift flex flex-wrap items-center gap-3 px-4 py-3.5">
            <div className="flex min-w-[200px] flex-[1_1_220px] flex-col gap-1">
              <span className="text-[16px] font-semibold">{fullName(p.first_name, p.last_name)}</span>
              <span className="flex flex-wrap items-center gap-x-4 text-[12px] text-rx-muted">
                <span>HN {p.patient_id}</span>
                <span>{stageLabel(p.current_stage)}</span>
              </span>
            </div>
            <div className="flex min-w-[160px] flex-[1_1_200px] flex-col gap-1">
              <span className="text-[12px] text-rx-muted">โปรแกรม</span>
              <span className="text-[14px]">{progName(p.patient_id, p.case_status !== 'CLOSED')}</span>
            </div>
            <Btn variant="outline" onClick={() => onOpenCase(p.patient_id)}>ประวัติการรักษา</Btn>
          </div>
        ))}
      </div>
    </>
  )
}
