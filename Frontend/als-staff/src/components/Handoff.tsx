import { useEffect, useState } from 'react'
import { CalendarCheck, CalendarClock, Check, ChevronRight } from 'lucide-react'
import type { AppointmentRequest, Patient, PatientAppointment } from '../types'
import { api, list, isTraining, slotLabel, apptSlot, thaiDate, ptName } from '../lib/clinic'
import { Btn, ErrorText } from './ui'

/**
 * งานสรุปผลของผู้ป่วยแต่ละคน (เวชระเบียน) — แสดงแค่เรื่องวันนัด
 * - นักกายภาพให้นัดต่อ / ยังไม่มีวันนัด → กล่องกดไปหน้าการนัด
 * - ลงวันนัดแล้ว → ข้อความวันนัด (ลงนัดแล้วถือว่าเสร็จ ระบบปิดงานให้เอง)
 * - เคสปิดการรักษาแล้ว → ไม่ต้องนัด กดเสร็จสิ้นได้เลย
 * appt = การมาครั้งนี้ที่นักกายภาพบันทึกผลแล้ว
 */
export default function Handoff({ patientId, patientName, appt, onDone, onGoSchedule }: {
  patientId: string; patientName: string; appt?: PatientAppointment; onDone: () => void
  /** ไปหน้าการนัด (ตารางนัด) · ส่งรหัสคำขอนัดไปด้วยเพื่อเปิดโหมดลงนัดให้ผู้ป่วยคนนี้ทันที */
  onGoSchedule: (requestId?: string) => void
}) {
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [upcoming, setUpcoming] = useState<PatientAppointment | null>(null)
  const [caseOpen, setCaseOpen] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    list<AppointmentRequest>(`/api/appointment-requests?patient_id=${patientId}`).then(setRequests)
    list<PatientAppointment>(`/api/appointments?patient_id=${patientId}`).then(as => {
      const now = new Date()
      setUpcoming(as.filter(a => isTraining(a) && a.status === 'SCHEDULED' && new Date(a.appointment_date) >= now)
        .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))[0] ?? null)
    })
    list<Patient>(`/api/patients?patient_id=${patientId}`).then(([p]) => setCaseOpen(!p || p.case_status !== 'CLOSED'))
  }, [patientId])

  const pending = requests[0]
  const finish = async () => {
    if (!appt) { onDone(); return }
    setBusy(true); setError('')
    try { await api('/api/appointments', { method: 'PATCH', body: { appointmentId: appt.appointment_id, action: 'CLOSE_VISIT' } }); onDone() }
    catch (e) { setError((e as Error).message); setBusy(false) }
  }

  // ลงวันนัดแล้วแต่งานยังไม่ปิด (นัดที่ลงไว้ก่อนระบบปิดงานอัตโนมัติ) → ปิดให้เลย
  useEffect(() => {
    if (upcoming && !pending && appt && !appt.records_done_at) finish()
  }, [upcoming?.appointment_id, pending?.request_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const goBox = (title: string, sub?: string | null) => (
    <button type="button" onClick={() => onGoSchedule(pending?.request_id)}
      className="flex w-full items-center gap-3 rounded-lg border border-[#F2D7AE] bg-[#FFF8EC] p-4 text-left transition-colors hover:bg-[#FFF0D9]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E08A1E] text-white"><CalendarClock size={20} /></div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold text-[#5C2E07]">{title}</span>
        {sub && <span className="text-[13px] text-[#8C420A]">{sub}</span>}
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold text-rx-accent">ไปหน้าการนัด <ChevronRight size={18} /></span>
    </button>
  )

  return (
    <div className="flex flex-col gap-3">
      {pending ? goBox(`${patientName} · ${ptName(pending.therapist_name)} ให้นัดครั้งถัดไป · ยังไม่ได้ลงวันนัด`, pending.note ? `หมายเหตุ: ${pending.note}` : null)
        : upcoming ? (
          <div className="flex items-center gap-3 rounded-lg bg-[#EAF7E3] px-4 py-3">
            <CalendarCheck size={20} className="shrink-0 text-[#2E8A0B]" />
            <span className="text-[15px] font-semibold text-[#145C38]">วันนัดของ {patientName}: {thaiDate(new Date(upcoming.appointment_date))} · {slotLabel(apptSlot(upcoming))} น.</span>
          </div>
        )
        : caseOpen ? goBox(`${patientName} · ยังไม่มีวันนัดครั้งถัดไป`)
        : (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-rx-bg px-4 py-3">
            <span className="flex-1 text-[14px] text-rx-muted">เคสนี้ปิดการรักษาแล้ว ไม่ต้องนัดต่อ</span>
            {appt && <Btn size="sm" disabled={busy} onClick={finish}><Check size={16} />{busy ? 'กำลังบันทึก...' : 'เสร็จสิ้น'}</Btn>}
          </div>
        )}
      <ErrorText>{error}</ErrorText>
    </div>
  )
}
