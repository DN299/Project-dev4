import { useEffect, useState } from 'react'
import type { AuthUser, Patient } from '../../types'
import { api, thaiShort, stageLabel, ptName, fullName } from '../../lib/clinic'
import { CENTER_PHONE } from '../../config'

interface Props { user: AuthUser; onLogout: () => void }

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="flex flex-col rounded-2xl bg-white px-4 py-3.5">
      <span className="text-[14px] font-semibold">{title}</span>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-t border-pt-divider py-2.5 text-[14px]">
          <span className="text-pt-muted">{k}</span>
          <span className="text-right font-medium">{v || '—'}</span>
        </div>
      ))}
    </div>
  )
}

export default function PatientProfilePage({ user, onLogout }: Props) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<Patient[]>(`/api/patients?patient_id=${user.patient_id}`).then(r => setPatient(r[0] ?? null)).catch(() => {}).finally(() => setLoading(false))
  }, [user.patient_id])

  if (loading) return <div className="py-16 text-center text-[13px] text-pt-muted">กำลังโหลด...</div>

  const name = fullName(patient?.first_name ?? user.first_name, patient?.last_name ?? user.last_name)
  const canUse = patient?.caretaker_can_use_app

  return (
    <div className="flex min-h-full flex-col gap-3.5">
      <div className="flex items-center gap-3.5 py-1">
        <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-pt-tint text-[22px] font-bold text-pt-accent-ink">{name.slice(0, 2)}</div>
        <div className="flex flex-col">
          <span className="text-[21px] font-bold">{name}</span>
          <span className="text-[13px] text-pt-muted">HN {user.patient_id}</span>
        </div>
      </div>
      <Section title="ข้อมูลส่วนตัว" rows={[
        ['วันเกิด', patient?.birth_date ? thaiShort(new Date(patient.birth_date)) : ''],
        ['เบอร์โทร', patient?.phone ?? ''],
        ['ระยะอาการ', stageLabel(patient?.current_stage)],
      ]} />
      <Section title="ผู้ดูแล" rows={[
        ['ชื่อ', patient?.caretaker_name ?? ''],
        ['ความสัมพันธ์', patient?.caretaker_relation ?? ''],
        ['ใช้แอปแทนได้', canUse == null ? '' : canUse ? 'ได้' : 'ไม่ได้'],
      ]} />
      <Section title="การรักษา" rows={[
        ['นักกายภาพ', patient?.primary_ot_name ? ptName(patient.primary_ot_name) : ''],
        ['ติดต่อศูนย์', CENTER_PHONE],
      ]} />
      <div className="flex-1" />
      <button type="button" onClick={onLogout} className="h-12 rounded-[14px] border border-[#F0C9C9] bg-white text-[15px] font-semibold text-[#A32D2D]">ออกจากระบบ</button>
    </div>
  )
}
