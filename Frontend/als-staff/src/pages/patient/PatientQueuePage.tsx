import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import type { PatientAppointment, PatientProgram } from '../../types'
import { list, rangeQuery, addDays, startOfDay, sameDay, thaiDate, hhmm, apptSlot, slotEnd, isTraining, ptName } from '../../lib/clinic'

interface Props { patientId: string; onTrain: () => void }

const POLL_MS = 10000

export default function PatientQueuePage({ patientId, onTrain }: Props) {
  const today = startOfDay(new Date())
  const [mine, setMine] = useState<PatientAppointment[]>([])
  const [dayAll, setDayAll] = useState<PatientAppointment[]>([])
  const [program, setProgram] = useState<PatientProgram | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = () => Promise.all([
      list<PatientAppointment>(`/api/appointments?patient_id=${patientId}`).then(setMine),
      list<PatientAppointment>(`/api/appointments?${rangeQuery(today, addDays(today, 1))}`).then(setDayAll),
      list<PatientProgram>(`/api/patient-programs?patient_id=${patientId}`).then(pp => setProgram(pp.find(p => p.status === 'ACTIVE') ?? null)),
    ]).finally(() => setLoading(false))
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  // นักกายภาพเริ่มฝึกแล้ว → เข้าหน้าระหว่างฝึกให้อัตโนมัติ
  const inProgress = mine.some(a => a.status === 'IN_PROGRESS' && isTraining(a) && sameDay(new Date(a.appointment_date), today))
  useEffect(() => { if (inProgress) onTrain() }, [inProgress]) // eslint-disable-line react-hooks/exhaustive-deps

  const title = (
    <div className="flex flex-col">
      <span className="text-[21px] font-bold">คิวของคุณวันนี้</span>
      <span className="text-[13px] text-pt-muted">{thaiDate(today)}</span>
    </div>
  )
  if (loading) return <div className="flex flex-col gap-3.5">{title}<div className="py-16 text-center text-[13px] text-pt-muted">กำลังโหลด...</div></div>

  const appt = mine.find(a => a.status !== 'CANCELLED' && sameDay(new Date(a.appointment_date), today))
  if (!appt) {
    const next = mine.filter(a => a.status === 'SCHEDULED' && new Date(a.appointment_date) > today).sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))[0]
    return (
      <div className="flex flex-col gap-3.5">
        {title}
        <div className="flex flex-col gap-1 rounded-[20px] bg-white px-5 py-[22px]">
          <span className="text-[17px] font-semibold">วันนี้ไม่มีนัด</span>
          <span className="text-[14px] text-pt-muted">{next ? `นัดถัดไป ${thaiDate(new Date(next.appointment_date))} ${hhmm(new Date(next.appointment_date))} น. · ${ptName(next.therapist_name)}` : 'ยังไม่มีนัดครั้งถัดไป'}</span>
        </div>
      </div>
    )
  }

  const s = apptSlot(appt)
  const assess = !isTraining(appt)
  const ahead = dayAll.filter(a => isTraining(a) && a.patient_id !== patientId && ['CHECKED_IN', 'IN_PROGRESS'].includes(a.status) && apptSlot(a) < s).length
  const st = appt.status
  const step = st === 'COMPLETED' ? 4 : st === 'IN_PROGRESS' ? 3 : st === 'CHECKED_IN' ? 2 : 1
  const badge =
    st === 'COMPLETED' ? ['เสร็จสิ้นแล้ว', '#E4F5EC', '#145C38']
    : st === 'IN_PROGRESS' ? ['ถึงคิวแล้ว · กำลังฝึก', '#E3EEF9', '#1F5573']
    : st === 'CHECKED_IN' && appt.called_at ? ['ถึงคิวแล้ว · รอเชื่อมต่อกระดาน', '#FFF0D9', '#8C420A']
    : st === 'CHECKED_IN' ? [`ตรงเวลา · ก่อนหน้าคุณ ${ahead} คน`, '#E4F5EC', '#145C38']
    : ['ยังไม่ได้รับคิว', '#FFF0D9', '#8C420A']

  const steps = [
    { t: 'รับคิวแล้ว', sub: appt.checked_in_at ? `${hhmm(new Date(appt.checked_in_at))} น.` : 'แจ้งชื่อหรือ HN ที่เคาน์เตอร์เวชระเบียน' },
    { t: 'รอถึงช่องเวลา', sub: 'นั่งรอบริเวณห้องกายภาพ' },
    { t: assess ? 'พบนักกายภาพเพื่อประเมิน' : 'กำลังฝึก', sub: assess ? 'ประเมินอาการและวางแผนการฝึก' : 'นักกายภาพจะผูกกระดานให้' },
    { t: 'เสร็จสิ้น', sub: assess ? 'ดูนัดครั้งถัดไปในแอป' : 'ดูผลได้ทันทีในแอป' },
  ]
  // ลำดับขั้น: ก่อนรับคิว = ขั้น 1 ยังไม่เสร็จ · รับคิวแล้ว = ขั้น 1 เสร็จ ขั้น 2 กำลังรอ
  const doneUpTo = st === 'SCHEDULED' ? 0 : step === 4 ? 4 : step - 1
  const current = st === 'SCHEDULED' ? 0 : step === 4 ? -1 : step - 1

  return (
    <div className="flex flex-col gap-3.5">
      {title}
      <div className="flex flex-col items-center gap-1.5 rounded-[20px] bg-white px-5 py-[22px] shadow-[0_1px_3px_rgba(31,29,43,0.06)]">
        <span className="text-[14px] text-pt-muted">ช่องเวลาของคุณ</span>
        <span className="text-[64px] font-bold leading-none text-pt-accent-ink">{s}</span>
        <span className="text-[14px] text-pt-muted">ถึง {slotEnd(s)} น.{program && !assess ? ` · ฝึก ${Math.round(program.duration_sec / 60)} นาที` : assess ? ' · ประเมินแรกรับ' : ''}</span>
        <span className="mt-1.5 whitespace-nowrap rounded-full px-3 py-[3px] text-[12px] font-semibold" style={{ background: badge[1], color: badge[2] }}>{badge[0]}</span>
      </div>

      <div className="flex flex-col gap-0.5 rounded-2xl bg-white px-4 py-3.5">
        {steps.map((x, i) => {
          const done = i < doneUpTo
          const cur = i === current
          return (
            <div key={x.t}>
              {i > 0 && <div className="ml-[13px] h-3 w-0.5 bg-pt-line" />}
              <div className="flex items-center gap-3">
                {done ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1F9D5C] text-white"><Check size={16} strokeWidth={2.6} /></div>
                ) : cur ? (
                  <div className="h-7 w-7 rounded-full border-[3px] border-pt-accent bg-white" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-pt-line" />
                )}
                <div className="flex flex-col">
                  <span className={`text-[15px] font-semibold ${done ? 'text-pt-ink' : cur ? 'text-pt-accent-ink' : 'text-pt-muted'}`}>{x.t}</span>
                  <span className="text-[12px] text-pt-muted">{x.sub}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
