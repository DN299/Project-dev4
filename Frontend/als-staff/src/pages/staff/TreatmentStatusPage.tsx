import { useEffect, useState } from 'react'
import type { AuthUser, PatientAppointment } from '../../types'
import {
  api, list, rangeQuery, addDays, startOfDay, thaiDate, slotLabel, apptSlot, hhmm, isTraining, queueState, BADGE,
  floorState, ptName, fullName,
} from '../../lib/clinic'
import Handoff from '../../components/Handoff'
import { ErrorText, GridTable, GridRow, Loading } from '../../components/ui'

interface Props { user: AuthUser; onOpenHistory: (patientId: string) => void; onGoSchedule: (requestId?: string) => void }

const COLS = '120px minmax(0, 1.6fr) minmax(0, 1fr) 170px 190px'
const POLL_MS = 5000

/**
 * หน้าสถานะ (เวชระเบียน) — ทำทีละคน:
 * 1 เรียกคิว (กระดานเชื่อมต่อเอง) → 2 นักกายภาพรักษาและบันทึกผล → 3 เวชระเบียนอ่านผล ลงนัดต่อ แล้วกดเสร็จสิ้น → 4 เรียกคิวถัดไป
 */
export default function TreatmentStatusPage({ user, onOpenHistory, onGoSchedule }: Props) {
  const today = startOfDay(new Date())
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(new Date())

  const load = () => Promise.all([
    list<PatientAppointment>(`/api/appointments?${rangeQuery(today, addDays(today, 1))}`).then(setAppts),
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
  const cur = training.find(a => a.status === 'IN_PROGRESS') ?? training.find(a => a.status === 'CHECKED_IN' && a.called_at)
  const reviewAppt = training.find(a => a.status === 'COMPLETED' && !a.records_done_at)
  const next = training.find(a => a.status === 'CHECKED_IN' && !a.called_at)

  // งานอื่นที่รอเวชระเบียน: ผู้ป่วยใหม่ที่ประเมินเสร็จวันนี้ (ไม่ขวางการเรียกคิว) · คำขอนัดลงที่หน้าตารางนัด
  const assessDone = appts.filter(a => a.appointment_type === 'ASSESSMENT' && a.status === 'COMPLETED' && !a.records_done_at)
  const todo = [
    ...assessDone.map(a => ({ key: a.appointment_id, patientId: a.patient_id, name: fullName(a.patient_name, a.patient_lastname), appt: a, sub: `ประเมินแรกรับเสร็จ · ${ptName(a.therapist_name)}` })),
  ]

  return (
    <>
      <div className="flex flex-col">
        <h1 className="m-0 text-[28px] font-bold leading-tight">สถานะ</h1>
        <span className="text-[13px] text-rx-muted">วันนี้ {thaiDate(today)}</span>
      </div>
      <ErrorText>{error}</ErrorText>

      <div className="flex flex-col gap-4 rx-card px-[22px] py-5">

        {state === 'treating' && cur && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-[#E3EEF9] p-4">
            <div className="flex flex-[1_1_260px] flex-col gap-1">
              <span className="text-[12px] text-[#1F5573]">กำลังรักษา · รอนักกายภาพบันทึกผล</span>
              <span className="text-[22px] font-semibold">{fullName(cur.patient_name, cur.patient_lastname)}</span>
              <span className="text-[13px] text-rx-muted">HN {cur.patient_id} · เริ่ม {cur.started_at ? hhmm(new Date(cur.started_at)) : cur.called_at ? hhmm(new Date(cur.called_at)) : ''} น. · ช่อง {slotLabel(apptSlot(cur))}</span>
            </div>
            <div className="flex flex-[1_1_200px] flex-col gap-1">
              <span className="text-[12px] text-rx-muted">นักกายภาพที่รักษา</span>
              <span className="text-[18px] font-semibold">{ptName(cur.treated_by_name ?? cur.therapist_name)}</span>
            </div>
          </div>
        )}

        {state === 'review' && reviewAppt && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[#8C420A]">นักกายภาพบันทึกผลแล้ว · ลงวันนัดครั้งถัดไปเพื่อเรียกคิวถัดไป</span>
            <Handoff key={reviewAppt.appointment_id} patientId={reviewAppt.patient_id} patientName={fullName(reviewAppt.patient_name, reviewAppt.patient_lastname)} appt={reviewAppt} onDone={load} onGoSchedule={onGoSchedule} />
          </div>
        )}

        {(state === 'free' || state === 'finished') && (
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-rx-bg p-4">
            <div className="flex flex-[1_1_260px] flex-col gap-1">
              <span className="text-[12px] text-rx-muted">คิวถัดไป</span>
              <span className="text-[22px] font-semibold">{next ? fullName(next.patient_name, next.patient_lastname) : 'ไม่มีผู้ป่วยรอ'}</span>
              {next && <span className="text-[13px] text-rx-muted">HN {next.patient_id} · นัด {slotLabel(apptSlot(next))} · {ptName(next.therapist_name)}</span>}
            </div>
            {next && (
              <button type="button" disabled={busy} onClick={() => callNext(next)} className="h-12 rounded-full bg-rx-accent px-6 text-[15px] font-semibold text-white disabled:bg-rx-soft disabled:text-rx-muted">
                เรียกคิว
              </button>
            )}
          </div>
        )}
      </div>

      {todo.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-[#F2D7AE] bg-white px-[22px] py-[18px]">
          <span className="pb-1 text-[16px] font-semibold">งานรอเวชระเบียน · {todo.length} รายการ</span>
          {todo.map(t => (
            <div key={t.key} className="flex flex-col gap-3 border-t border-rx-divider py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-[1_1_260px] flex-col">
                  <span className="text-[15px] font-semibold">{t.name}</span>
                  <span className="text-[13px] text-rx-muted">HN {t.patientId} · {t.sub}</span>
                </div>
              </div>
              <Handoff patientId={t.patientId} patientName={t.name} appt={t.appt} onDone={load} onGoSchedule={onGoSchedule} />
            </div>
          ))}
        </div>
      )}

      <span className="pt-1 text-[15px] font-semibold">สถานะของแต่ละช่วงเวลาวันนี้</span>
      <GridTable cols={COLS} minWidth={600} head={['ช่วงเวลา', 'ผู้ป่วย', 'นักกายภาพ', 'สถานะ', '']}>
        {training.length === 0 && <div className="border-t border-rx-divider px-6 py-5 text-[14px] text-rx-muted">วันนี้ไม่มีนัดใช้กระดาน</div>}
        {training.map(a => {
          const st = queueState(a, today)
          return (
            <GridRow key={a.appointment_id} cols={COLS}>
              <span className="font-semibold">{slotLabel(apptSlot(a))}</span>
              <span className="font-semibold">{fullName(a.patient_name, a.patient_lastname)}</span>
              <span>{ptName(a.treated_by_name ?? a.therapist_name)}</span>
              <span className="justify-self-start whitespace-nowrap rounded-full px-3 py-[3px] text-[12px] font-semibold" style={{ background: BADGE[st][1], color: BADGE[st][2] }}>{BADGE[st][0]}</span>
              <div className="justify-self-end">
                {st === 'done' && (
                  <button type="button" onClick={() => onOpenHistory(a.patient_id)} className="inline-flex h-9 items-center whitespace-nowrap rounded-full rx-glass-control px-3 text-[13px] font-semibold text-rx-accent-ink">อ่านประวัติการรักษา</button>
                )}
              </div>
            </GridRow>
          )
        })}
      </GridTable>
    </>
  )
}
