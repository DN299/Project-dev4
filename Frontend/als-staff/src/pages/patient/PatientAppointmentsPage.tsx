import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import type { PatientAppointment } from '../../types'
import { list, startOfDay, sameDay, DOW, MON, hhmm, ptName, isTraining } from '../../lib/clinic'

interface Props { patientId: string }

const dayLabel = (d: Date) => `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`

const PAST_BADGE: Record<string, [string, string, string]> = {
  COMPLETED: ['มาแล้ว', '#E4F5EC', '#145C38'],
  NO_SHOW: ['ไม่มา', '#FCEBEB', '#791F1F'],
  SCHEDULED: ['ไม่มา', '#FCEBEB', '#791F1F'],
}

export default function PatientAppointmentsPage({ patientId }: Props) {
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    list<PatientAppointment>(`/api/appointments?patient_id=${patientId}`).then(setAppts).finally(() => setLoading(false))
  }, [patientId])

  if (loading) return <div className="py-16 text-center text-[13px] text-pt-muted">กำลังโหลด...</div>

  const now = new Date()
  const today = startOfDay(now)
  // นัดที่ยังไม่จบ (วันนี้ที่ยังไม่เสร็จ หรือวันข้างหน้า)
  const upcoming = appts
    .filter(a => ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS'].includes(a.status) && new Date(a.appointment_date) >= today)
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
  const past = appts
    .filter(a => !upcoming.includes(a) && a.status !== 'CANCELLED')
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))
  const [next, ...rest] = upcoming
  const nd = next ? new Date(next.appointment_date) : null

  const row = (a: PatientAppointment, badge: [string, string, string]) => {
    const d = new Date(a.appointment_date)
    return (
      <div key={a.appointment_id} className="flex items-center gap-3 border-t border-pt-divider py-2.5">
        <CalendarDays size={20} className="text-pt-muted" />
        <div className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold">{dayLabel(d)}</span>
          <span className="text-[12px] text-pt-muted">{hhmm(d)} น. · {ptName(a.therapist_name)}</span>
        </div>
        <span className="self-start whitespace-nowrap rounded-full px-3 py-[3px] text-[12px] font-semibold" style={{ background: badge[1], color: badge[2] }}>{badge[0]}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col">
        <span className="text-[21px] font-bold">นัดหมาย</span>
        <span className="text-[13px] text-pt-muted">นัดทั้งหมดของคุณ</span>
      </div>

      {next && nd ? (
        <div className="flex flex-col gap-1 rounded-2xl bg-pt-tint p-4">
          <span className="text-[12px] font-semibold text-pt-accent-ink">นัดถัดไป</span>
          <span className="text-[22px] font-bold text-[#5C2408]">{sameDay(nd, today) ? 'วันนี้' : dayLabel(nd)} {hhmm(nd)} น.</span>
          <span className="text-[14px] text-[#712B13]">{ptName(next.therapist_name)} · {isTraining(next) ? 'ฝึกกับกระดาน' : 'ประเมินแรกรับ'}</span>
          <span className="mt-1 text-[12px] text-[#712B13]">มาถึงแล้วแจ้งชื่อหรือ HN ที่เคาน์เตอร์</span>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-4 text-[14px] text-pt-muted">ยังไม่มีนัดครั้งถัดไป · นักกายภาพจะลงนัดให้หลังการฝึก</div>
      )}

      {rest.length > 0 && (
        <div className="flex flex-col rounded-2xl bg-white px-4 py-3.5">
          <span className="text-[14px] font-semibold">นัดที่จะถึง</span>
          {rest.map(a => row(a, ['นัด', '#FBE7DC', '#A8430F']))}
        </div>
      )}

      {past.length > 0 && (
        <div className="flex flex-col rounded-2xl bg-white px-4 py-3.5">
          <span className="text-[14px] font-semibold">ที่ผ่านมา</span>
          {past.map(a => row(a, PAST_BADGE[a.status] ?? PAST_BADGE.COMPLETED))}
        </div>
      )}
    </div>
  )
}
