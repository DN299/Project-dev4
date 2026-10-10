import { useEffect, useState } from 'react'
import type { AuthUser, Device, PatientAppointment } from '../../types'
import {
  api, list, rangeQuery, addDays, startOfDay, thaiDate, slotLabel, apptSlot, hhmm, isTraining, queueState, BADGE,
  floorState, ptName, fullName,
} from '../../lib/clinic'
import { Badge, ErrorText, GridTable, GridRow, Loading, Notice } from '../../components/ui'

interface Props { user: AuthUser }

const COLS = '120px minmax(0, 1.6fr) minmax(0, 1fr) 130px'
const POLL_MS = 5000

const STATE_VIEW = {
  treating: { text: 'กำลังรักษาอยู่', color: '#1F5573', badge: 'ยังเรียกคิวถัดไปไม่ได้', bg: '#E3EEF9' },
  finished: { text: 'รักษาเสร็จแล้ว', color: '#145C38', badge: 'เรียกคิวถัดไปได้', bg: '#E4F5EC' },
  free: { text: 'คิวว่างแล้ว', color: '#145C38', badge: 'เรียกคิวถัดไปได้', bg: '#E4F5EC' },
} as const

// หน้านี้แสดงเฉพาะวันนี้ · ใช้รู้ว่าเรียกคิวถัดไปได้หรือยัง
export default function TreatmentStatusPage({ user }: Props) {
  const today = startOfDay(new Date())
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(new Date())

  const load = () => Promise.all([
    list<PatientAppointment>(`/api/appointments?${rangeQuery(today, addDays(today, 1))}`).then(setAppts),
    list<Device>('/api/devices').then(setDevices),
  ]).finally(() => { setLoading(false); setNow(new Date()) })

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const callNext = async (a: PatientAppointment) => {
    setBusy(true); setError('')
    try { await api('/api/appointments', { method: 'PATCH', body: { appointmentId: a.appointment_id, action: 'CALL', calledBy: user.users_id } }); await load() }
    catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  if (loading) return <Loading />

  const training = appts.filter(a => isTraining(a) && a.status !== 'CANCELLED').sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
  const state = floorState(training, now)
  const view = STATE_VIEW[state]
  const cur = training.find(a => a.status === 'IN_PROGRESS') ?? training.find(a => a.status === 'CHECKED_IN' && a.called_at)
  const last = [...training].filter(a => a.status === 'COMPLETED').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))[0]
  const next = training.find(a => a.status === 'CHECKED_IN' && !a.called_at)
  const nextDue = !!next && new Date(next.appointment_date) <= now
  const board = devices.find(d => d.device_id === (cur ?? next ?? last)?.device_id) ?? devices.find(d => d.status === 'ACTIVE')

  return (
    <>
      <div className="flex flex-col">
        <h1 className="m-0 text-[30px] font-semibold">ติดตามการรักษา</h1>
        <span className="text-[13px] text-rx-muted">วันนี้ {thaiDate(today)} · ดูว่าเรียกคิวถัดไปได้หรือยัง</span>
      </div>
      <ErrorText>{error}</ErrorText>

      <div className="flex flex-col gap-4 rounded-lg bg-white px-[22px] py-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-col">
            <span className="text-[13px] text-rx-muted">กระดาน {board?.device_name ?? '—'}{cur ? ` · ช่วงเวลา ${slotLabel(apptSlot(cur))}` : ''}</span>
            <span className="text-[26px] font-semibold" style={{ color: view.color }}>{view.text}</span>
          </div>
          <Badge label={view.badge} bg={view.bg} fg={view.color} className="px-3.5 py-1 text-[13px]" />
        </div>

        {state === 'treating' && cur && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-rx-bg p-4">
            <div className="flex flex-[1_1_260px] flex-col gap-1">
              <span className="text-[12px] text-rx-muted">ผู้ป่วยที่กำลังรักษา</span>
              <span className="text-[20px] font-semibold">{fullName(cur.patient_name, cur.patient_lastname)}</span>
              <span className="text-[13px] text-rx-muted">
                HN {cur.patient_id} · {cur.status === 'IN_PROGRESS'
                  ? `เชื่อมต่อกระดานแล้ว ${cur.started_at ? hhmm(new Date(cur.started_at)) : ''} น.`
                  : `เรียกคิวแล้ว ${cur.called_at ? hhmm(new Date(cur.called_at)) : ''} น. · รอนักกายภาพเชื่อมต่อกระดาน`}
              </span>
            </div>
            <div className="flex flex-[1_1_200px] flex-col gap-1">
              <span className="text-[12px] text-rx-muted">นักกายภาพที่ดูแล</span>
              <span className="text-[18px] font-semibold">{ptName(cur.treated_by_name ?? cur.therapist_name)}</span>
            </div>
          </div>
        )}

        {state !== 'treating' && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-rx-bg p-4">
            <div className="flex flex-[1_1_260px] flex-col gap-1">
              <span className="text-[12px] text-rx-muted">คิวถัดไป</span>
              <span className="text-[20px] font-semibold">{next ? fullName(next.patient_name, next.patient_lastname) : 'ไม่มีผู้ป่วยรอ'}</span>
              <span className="text-[13px] text-rx-muted">
                {next ? `ช่อง ${slotLabel(apptSlot(next))} · ${ptName(next.therapist_name)} · มาแล้ว${nextDue ? '' : ' · ยังไม่ถึงเวลา'}` : 'คนถัดไปยังไม่มาถึง หรือยังไม่ได้รับเข้าคิว'}
              </span>
              {state === 'finished' && last && <span className="text-[12px] text-[#145C38]">ล่าสุด: {fullName(last.patient_name, last.patient_lastname)} รักษาเสร็จ {last.completed_at ? hhmm(new Date(last.completed_at)) : ''} น.</span>}
            </div>
            {next && (
              <button type="button" disabled={busy || !nextDue} onClick={() => callNext(next)} className="h-12 rounded-lg bg-rx-accent px-5 text-[15px] font-semibold text-white disabled:bg-rx-soft disabled:text-rx-muted">
                {nextDue ? 'เรียกคิวถัดไป' : `เรียกได้เมื่อถึง ${apptSlot(next)} น.`}
              </button>
            )}
          </div>
        )}
      </div>

      <span className="pt-1 text-[15px] font-semibold">สถานะของแต่ละช่วงเวลาวันนี้</span>
      <GridTable cols={COLS} minWidth={560} head={['ช่วงเวลา', 'ผู้ป่วย', 'นักกายภาพ', 'ติดตามการรักษา']}>
        {training.length === 0 && <div className="border-t border-rx-divider px-[18px] py-4 text-[14px] text-rx-muted">วันนี้ไม่มีนัดใช้กระดาน</div>}
        {training.map(a => {
          const st = queueState(a, today)
          return (
            <GridRow key={a.appointment_id} cols={COLS}>
              <span className="font-semibold">{slotLabel(apptSlot(a))}</span>
              <span className="font-semibold">{fullName(a.patient_name, a.patient_lastname)}</span>
              <span>{ptName(a.treated_by_name ?? a.therapist_name)}</span>
              <span className="justify-self-start whitespace-nowrap rounded-full px-3 py-[3px] text-[12px] font-semibold" style={{ background: BADGE[st][1], color: BADGE[st][2] }}>{BADGE[st][0]}</span>
            </GridRow>
          )
        })}
      </GridTable>
      <Notice>ทั้งศูนย์มีผู้ป่วยกำลังรักษาได้ทีละคน · เรียกคิวถัดไปได้เมื่อคนปัจจุบันรักษาเสร็จและถึงช่องเวลาของคนถัดไป · นักกายภาพเป็นผู้เชื่อมต่อกระดานหลังยืนยันตัวผู้ป่วย</Notice>
    </>
  )
}
