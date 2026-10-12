import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import type { AppointmentRequest } from '../../types'
import { requestRange } from '../../components/AppointmentRequests'
import { PatientHeader, VisitCard } from '../../components/VisitHistory'
import { useCase, pastVisits } from '../../lib/useCase'
import { BackLink, Loading, Stat } from '../../components/ui'
import { avg, list, ptName } from '../../lib/clinic'

interface Props { patientId: string; onBack: () => void; backLabel?: string }

const PAGE = 10

export default function PatientHistoryPage({ patientId, onBack, backLabel = 'กลับไปคิวผู้ป่วย' }: Props) {
  const { patient, appts, sessions, programs, amendments, loading } = useCase(patientId)
  const [show, setShow] = useState(PAGE)
  // ข้อความขอนัดที่นักกายภาพส่งมา (รอเวชระเบียนลงนัด)
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  useEffect(() => { list<AppointmentRequest>(`/api/appointment-requests?patient_id=${patientId}`).then(setRequests) }, [patientId])

  if (loading) return <Loading />
  if (!patient) return <><BackLink onClick={onBack}>{backLabel}</BackLink><Loading text="ไม่พบข้อมูลผู้ป่วย" /></>

  const visits = pastVisits(appts)
  const came = visits.filter(v => v.status === 'COMPLETED')
  const avgReps = avg(sessions.map(s => s.total_reps))
  const shown = visits.slice(0, show)
  const caretaker = patient.caretaker_name ? `ผู้ดูแล ${patient.caretaker_name}${patient.caretaker_phone ? ` ${patient.caretaker_phone}` : ''}` : ''

  return (
    <>
      <BackLink onClick={onBack}>{backLabel}</BackLink>
      <PatientHeader patient={patient} programs={programs} extra={[caretaker]} showPt />
      {requests.map(r => (
        <div key={r.request_id} className="flex flex-wrap items-center gap-3.5 rounded-lg border border-[#F2D7AE] bg-[#FFF8EC] px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E08A1E] text-white"><CalendarClock size={20} /></div>
          <div className="flex flex-[1_1_300px] flex-col gap-0.5">
            <span className="text-[13px] text-[#8C420A]">{ptName(r.therapist_name)} ขอให้นัดครั้งถัดไป · ช่วง {requestRange(r)}</span>
            <span className="text-[16px] font-semibold text-[#5C2E07]">“{r.note || r.window_label}”</span>
          </div>
          <span className="text-[12px] text-[#8C420A]">ลงนัดได้ที่หน้าตารางนัด</span>
        </div>
      ))}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Stat label="มารักษาทั้งหมด" value={`${came.length} ครั้ง`} />
        <Stat label="ครั้งเฉลี่ยต่อเซต" value={avgReps != null ? avgReps.toFixed(1) : '–'} color="#0066D6" />
      </div>
      <span className="text-[16px] font-semibold">ประวัติการรักษา</span>
      {shown.length === 0 && <div className="rx-card px-5 py-6 text-[14px] text-rx-muted">ยังไม่มีประวัติการมารักษา</div>}
      {shown.map(a => <VisitCard key={a.appointment_id} a={a} sessions={sessions} patient={patient} variant="staff" amendments={amendments} />)}
      <div className="flex flex-col items-center gap-2.5 py-1">
        <span className="text-[13px] text-rx-muted">แสดง {shown.length} จาก {visits.length} ครั้ง</span>
        {visits.length > shown.length && (
          <button type="button" onClick={() => setShow(visits.length)} className="h-11 rounded-lg border border-rx-accent bg-white px-8 text-[14px] font-semibold text-rx-accent">ดูทั้งหมด</button>
        )}
      </div>
      <span className="text-[12px] text-rx-muted">เวชระเบียนเห็นผลการรักษา (A) และคำแนะนำ (P) ของนักกายภาพ · อาการที่ผู้ป่วยเล่าและผลตรวจวัด (S, O) เปิดดูได้เฉพาะนักกายภาพ</span>
    </>
  )
}
