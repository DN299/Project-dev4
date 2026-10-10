import { useState } from 'react'
import { PatientHeader, VisitCard } from '../../components/VisitHistory'
import { useCase, pastVisits } from '../../lib/useCase'
import { BackLink, Loading, Stat } from '../../components/ui'
import { avg } from '../../lib/clinic'

interface Props { patientId: string; onBack: () => void }

const PAGE = 10

export default function PatientHistoryPage({ patientId, onBack }: Props) {
  const { patient, appts, sessions, programs, amendments, loading } = useCase(patientId)
  const [show, setShow] = useState(PAGE)

  if (loading) return <Loading />
  if (!patient) return <><BackLink onClick={onBack}>กลับไปคิวผู้ป่วย</BackLink><Loading text="ไม่พบข้อมูลผู้ป่วย" /></>

  const visits = pastVisits(appts)
  const came = visits.filter(v => v.status === 'COMPLETED')
  const avgReps = avg(sessions.map(s => s.total_reps))
  const shown = visits.slice(0, show)
  const caretaker = patient.caretaker_name ? `ผู้ดูแล ${patient.caretaker_name}${patient.caretaker_phone ? ` ${patient.caretaker_phone}` : ''}` : ''

  return (
    <>
      <BackLink onClick={onBack}>กลับไปคิวผู้ป่วย</BackLink>
      <PatientHeader patient={patient} programs={programs} extra={[caretaker]} showPt />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Stat label="มารักษาทั้งหมด" value={`${came.length} ครั้ง`} />
        <Stat label="ครั้งเฉลี่ยต่อเซต" value={avgReps != null ? avgReps.toFixed(1) : '–'} color="#3A40C9" />
      </div>
      <span className="text-[16px] font-semibold">ประวัติการรักษา</span>
      {shown.length === 0 && <div className="rounded-lg bg-white px-5 py-6 text-[14px] text-rx-muted">ยังไม่มีประวัติการมารักษา</div>}
      {shown.map(a => <VisitCard key={a.appointment_id} a={a} sessions={sessions} patient={patient} variant="staff" amendments={amendments} />)}
      <div className="flex flex-col items-center gap-2.5 py-1">
        <span className="text-[13px] text-rx-muted">แสดง {shown.length} จาก {visits.length} ครั้ง</span>
        {visits.length > shown.length && (
          <button type="button" onClick={() => setShow(visits.length)} className="h-11 rounded-lg border border-rx-accent bg-white px-8 text-[14px] font-semibold text-rx-accent">ดูทั้งหมด</button>
        )}
      </div>
      <span className="text-[12px] text-rx-muted">บันทึกการรักษาฉบับเต็ม (SOAP) เปิดดูได้ที่หน้าของนักกายภาพ</span>
    </>
  )
}
