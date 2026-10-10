import { useEffect, useState } from 'react'
import type { Patient, PatientAppointment, Device, TherapySession, PatientProgram, PageKey } from '../../types'
import { PlayCircle, Wifi, WifiOff, CalendarDays, Flame, Check } from 'lucide-react'
import { api, list, isTraining, boardLink, BOARD_LINK_LABEL, sameDay, startOfDay, thaiDate, hhmm, ptName } from '../../lib/clinic'
import { ProgressRing, SetSegments } from './patientUi'
import { fmtClock, sessionsOnDay } from './patientUtils'

interface Props { patientId: string; onNavigate: (p: PageKey) => void; onLogout: () => void }

export default function PatientHomePage({ patientId, onNavigate, onLogout }: Props) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [sessions, setSessions] = useState<TherapySession[]>([])
  const [programs, setPrograms] = useState<PatientProgram[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api<Patient[]>(`/api/patients?patient_id=${patientId}`).then(r => setPatient(r[0] ?? null)).catch(() => {}),
      list<PatientAppointment>(`/api/appointments?patient_id=${patientId}`).then(setAppts),
      list<Device>('/api/devices').then(setDevices),
      list<TherapySession>(`/api/sessions?patient_id=${patientId}`).then(setSessions),
      list<PatientProgram>(`/api/patient-programs?patient_id=${patientId}`).then(setPrograms),
    ]).finally(() => setLoading(false))
  }, [patientId])

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-[17px] font-bold">ALS Rehab</span>
        <span className="text-[12px] text-pt-muted">ระบบติดตามการฝึกและนัดหมาย</span>
      </div>
      <button type="button" onClick={onLogout} className="h-9 rounded-[10px] border border-[#E4E0EC] bg-white px-3.5 text-[13px]">ออกจากระบบ</button>
    </div>
  )

  if (loading) return <div className="flex flex-col gap-3">{header}<div className="py-16 text-center text-[13px] text-pt-muted">กำลังโหลด...</div></div>
  if (!patient) return <div className="flex flex-col gap-3">{header}<div className="py-16 text-center text-[14px] font-semibold">ไม่พบข้อมูลผู้ป่วย</div></div>

  const now = new Date()
  const today = startOfDay(now)
  const training = appts.filter(isTraining)
  const todayAppt = training.find(a => a.status !== 'CANCELLED' && sameDay(new Date(a.appointment_date), today))
  const nextAppt = training.filter(a => a.status === 'SCHEDULED' && new Date(a.appointment_date) > now).sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))[0]
  // มาตามนัด: นัดฝึกที่ถึงกำหนดแล้ว (ไม่นับที่ยกเลิก) เทียบกับครั้งที่มาจริง
  const due = training.filter(a => a.status !== 'CANCELLED' && (new Date(a.appointment_date) < today || ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(a.status)))
  const came = due.filter(a => ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(a.status)).length
  const myDevice = devices.find(d => d.device_id === todayAppt?.device_id)
  // ยังไม่เชื่อมต่อ / รอเชื่อมต่อ (เรียกคิวแล้ว) / เชื่อมต่อแล้ว / ตัดการเชื่อมต่อแล้ว
  const link = boardLink(todayAppt)
  const connected = link === 'connected'
  const firstName = (patient.first_name ?? '').trim() || patient.patient_id

  const active = programs.filter(p => p.status === 'ACTIVE')
  const program = active[0]
  const totalSets = program?.session_per_day ?? 0
  const today_ = sessionsOnDay(sessions, now)
  const setsToday = today_.length
  const repsToday = today_.reduce((s, x) => s + x.total_reps, 0)

  return (
    <div className="flex flex-col gap-3">
      {header}
      <div className="mt-1 flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[21px] font-bold">สวัสดี, {firstName}</span>
          <span className="text-[12px] text-pt-muted">รหัสผู้ป่วย: {patient.patient_id}</span>
        </div>
        {due.length > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-[#FFF0D9] px-3 py-1.5 text-[13px] font-semibold text-[#8C420A]">
            <Flame size={14} /> {came === due.length ? 'มาตามนัดครบ' : `มาตามนัด ${came}/${due.length}`}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <ProgressRing size={150} stroke={12} pct={totalSets ? setsToday / totalSets : 0}>
          <span className="text-[30px] font-bold leading-tight">{Math.min(setsToday, totalSets || setsToday)}/{totalSets || '–'}</span>
          <span className="text-[11px] text-pt-muted">เซตวันนี้</span>
        </ProgressRing>
        <div className="flex gap-4 text-[12px] text-pt-muted">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#D93F3F]" />ทำได้วันนี้ {repsToday} ครั้ง</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#6D4BC2]" />มาตามนัด {came}/{due.length} ครั้ง</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(31,29,43,0.06)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] text-pt-muted">โปรแกรมฝึกวันนี้</span>
          {program ? (
            <>
              <span className="text-[17px] font-bold">{active.map(p => p.program_name).join(' · ')}</span>
              <span className="text-[12px] text-pt-muted">{totalSets} เซต · {Math.round(program.duration_sec / 60)} นาที · ฝึกที่ศูนย์ตามนัด · ทำได้เท่าไหร่บันทึกตามนั้น</span>
            </>
          ) : (
            <span className="text-[14px] text-pt-muted">ยังไม่ได้รับโปรแกรมการฝึก นักกายภาพจะกำหนดให้หลังประเมินอาการ</span>
          )}
        </div>
        {program && (
          <>
            <SetSegments done={setsToday} total={totalSets} />
            <div className="flex justify-between text-[12px] text-pt-muted">
              <span>ทำแล้ว {Math.min(setsToday, totalSets)}/{totalSets} เซตวันนี้</span>
              <span>{Math.min(setsToday, totalSets)}/{totalSets}</span>
            </div>
            {today_.map((s, i) => (
              <div key={s.session_id} className="flex items-center gap-2 rounded-[10px] bg-pt-bg px-3 py-2 text-[13px]">
                <Check size={16} strokeWidth={2.4} className="text-[#1F9D5C]" />
                <span>เซต {i + 1}: <span className="font-semibold">ทำได้ {s.total_reps} ครั้ง</span> · {fmtClock(s.session_date)}</span>
              </div>
            ))}
          </>
        )}
        <button type="button" onClick={() => onNavigate('patient-queue')} className="flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-pt-accent text-[16px] font-semibold text-white active:scale-[.98]">
            <PlayCircle size={18} /> ดูคิวของฉันวันนี้
          </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col gap-1 rounded-2xl bg-white px-3.5 py-3">
          {connected ? <Wifi size={18} className="text-[#1F9D5C]" /> : <WifiOff size={18} className={link === 'waiting' ? 'text-[#8C420A]' : 'text-pt-muted'} />}
          <span className={`text-[14px] font-semibold ${connected ? 'text-[#145C38]' : link === 'waiting' ? 'text-[#8C420A]' : 'text-pt-muted'}`}>{BOARD_LINK_LABEL[link]}</span>
          <span className="text-[12px] text-pt-muted">
            {link === 'waiting' ? 'ถึงคิวแล้ว · นักกายภาพกำลังเชื่อมต่อกระดาน' : myDevice ? `กระดาน ${myDevice.device_name || myDevice.device_id}` : 'นักกายภาพจะเชื่อมต่อกระดานให้'}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-white px-3.5 py-3">
          <CalendarDays size={18} className="text-[#2A6F97]" />
          <span className="text-[14px] font-semibold leading-snug text-[#1F5573]">
            {todayAppt ? `นัดวันนี้ ${hhmm(new Date(todayAppt.appointment_date))}` : nextAppt ? thaiDate(new Date(nextAppt.appointment_date)) : 'ยังไม่มีนัด'}
          </span>
          <span className="text-[12px] text-pt-muted">
            {todayAppt ? ptName(todayAppt.therapist_name) : nextAppt ? `${hhmm(new Date(nextAppt.appointment_date))} น. · ${ptName(nextAppt.therapist_name)}` : 'นัดถัดไปจะแสดงที่นี่'}
          </span>
        </div>
      </div>
    </div>
  )
}
