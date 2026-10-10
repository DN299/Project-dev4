import { useEffect, useState } from 'react'
import type { AuthUser, PatientAppointment } from '../../types'
import {
  api, list, rangeQuery, SLOTS, LUNCH_BEFORE, slotLabel, apptSlot, addDays, startOfDay, sameDay, mondayOf,
  isoDate, fromIsoDate, thaiDate, dayMonth, hhmm, isClosedDay, isTraining, trainingAt, queueState, BADGE,
  ptName, fullName, DOWS,
} from '../../lib/clinic'
import { Badge, GridTable, GridRow, Loading, ErrorText } from '../../components/ui'

interface Props { user: AuthUser; onOpenPatient: (patientId: string) => void }

const COLS = '120px minmax(0, 1.6fr) minmax(0, 1fr) 120px 150px'

export default function QueuePage({ user, onOpenPatient }: Props) {
  const today = startOfDay(new Date())
  const [sel, setSel] = useState(today)
  const [view, setView] = useState<'day' | 'week'>('day')
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const mon = mondayOf(sel)
  const load = () => list<PatientAppointment>(`/api/appointments?${rangeQuery(mon, addDays(mon, 7))}`).then(setAppts).finally(() => setLoading(false))
  useEffect(() => { load() }, [mon.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  const checkIn = async (a: PatientAppointment) => {
    setBusy(a.appointment_id); setError('')
    try { await api('/api/appointments', { method: 'PATCH', body: { appointmentId: a.appointment_id, action: 'CHECK_IN', checkedInBy: user.users_id } }); await load() }
    catch (e) { setError((e as Error).message) }
    setBusy(null)
  }

  const isToday = sameDay(sel, today)
  const dayAppts = appts.filter(a => sameDay(new Date(a.appointment_date), sel))
  const assessments = dayAppts.filter(a => a.appointment_type === 'ASSESSMENT' && a.status !== 'CANCELLED')
  // นัดฝึกครั้งถัดไปของผู้ป่วย (ดูจากนัดทั้งหมดที่โหลดมา)
  const [future, setFuture] = useState<PatientAppointment[]>([])
  useEffect(() => {
    if (!isToday || assessments.length === 0) return
    list<PatientAppointment>(`/api/appointments?${rangeQuery(today, addDays(today, 60))}`).then(setFuture)
  }, [isToday, assessments.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const tgl = (on: boolean) => `h-11 px-4 text-[13px] font-semibold ${on ? 'bg-rx-tint text-rx-accent-ink' : 'bg-white text-rx-ink'}`

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="m-0 text-[30px] font-semibold">คิวผู้ป่วย</h1>
          <span className="text-[13px] text-rx-muted">ดูได้ทั้งรายวันและรายสัปดาห์ ย้อนหลังและล่วงหน้า</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-rx-line bg-white">
            <button type="button" onClick={() => setView('day')} className={tgl(view === 'day')}>รายวัน</button>
            <button type="button" onClick={() => setView('week')} className={tgl(view === 'week')}>รายสัปดาห์</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white py-1.5 pl-3 pr-2">
            <label htmlFor="jump" className="text-[13px] text-rx-muted">เลือกวันที่</label>
            <input id="jump" type="date" value={isoDate(sel)} onChange={e => e.target.value && setSel(fromIsoDate(e.target.value))} className="h-10 rounded-[10px] border border-rx-line bg-white px-2.5 text-[14px]" />
            <button type="button" onClick={() => setSel(today)} className="h-10 whitespace-nowrap rounded-[10px] border border-rx-line bg-white px-3.5 text-[13px] font-semibold">วันนี้</button>
          </div>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      {loading ? <Loading /> : view === 'day' ? (
        <div className="flex flex-col gap-[18px]">
          {isClosedDay(sel) ? (
            <div className="flex flex-col gap-3 rounded-lg bg-white px-5 py-[22px]">
              <span className="text-[15px] font-semibold">ศูนย์ปิดวันอาทิตย์</span>
              <span className="text-[13px] text-rx-muted">ไม่มีนัดและไม่มีการใช้กระดานในวันนี้</span>
            </div>
          ) : (
            <>
              {isToday && (() => {
                const now = dayAppts.find(a => isTraining(a) && a.status === 'IN_PROGRESS')
                return (
                  <div className="flex flex-wrap items-center gap-4 rounded-lg bg-white px-[22px] py-[18px]">
                    <div className="flex flex-[1_1_260px] flex-col gap-1">
                      <span className="text-[12px] text-rx-muted">ผู้ที่กำลังฝึก</span>
                      <span className="text-[20px] font-semibold">{now ? fullName(now.patient_name, now.patient_lastname) : 'ไม่มีผู้ป่วยกำลังฝึก'}</span>
                      {now && <span className="text-[13px] text-rx-muted">HN {now.patient_id} · ช่อง {slotLabel(apptSlot(now))} · {ptName(now.treated_by_name ?? now.therapist_name)}{now.device_name ? ` · กระดาน ${now.device_name}` : ''}</span>}
                    </div>
                    {now && <Badge state="now" />}
                  </div>
                )
              })()}

              {isToday && assessments.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg bg-white px-[22px] py-[18px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 pb-1.5">
                    <span className="text-[16px] font-semibold">ผู้ป่วยใหม่ส่งประเมินวันนี้</span>
                    <span className="text-[12px] text-rx-muted">ประเมินตามเวลาที่นักกายภาพว่าง · ไม่ใช้กระดาน · ฝึกจริงเมื่อมีนัดครั้งถัดไป</span>
                  </div>
                  {assessments.map(a => {
                    const done = a.status === 'COMPLETED'
                    const next = done ? future.find(f => f.patient_id === a.patient_id && isTraining(f) && f.status === 'SCHEDULED') : undefined
                    const nd = next ? new Date(next.appointment_date) : null
                    return (
                      <div key={a.appointment_id} className="flex flex-wrap items-center gap-3 border-t border-rx-divider py-3">
                        <div className="flex flex-[1_1_260px] flex-col">
                          <span className="text-[15px] font-semibold">{fullName(a.patient_name, a.patient_lastname)}</span>
                          <span className="text-[13px] text-rx-muted">
                            HN {a.patient_id}{a.checked_in_at ? ` · ลงทะเบียน ${hhmm(new Date(a.checked_in_at))}` : ''} · {done ? 'ประเมิน' : 'นัดประเมิน'} {slotLabel(apptSlot(a))}
                          </span>
                        </div>
                        <span className="text-[13px]">{ptName(a.therapist_name)}</span>
                        <Badge
                          state={done ? 'assessed' : 'assess'}
                          label={done ? `ประเมินแล้ว${nd ? ` · นัดฝึก ${DOWS[nd.getDay()]}. ${dayMonth(nd)} ${hhmm(nd)}` : ''}` : undefined}
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <span className="text-[15px] font-semibold">ตารางเวลา {thaiDate(sel)}</span>
                <span className="text-[13px] text-rx-muted">กด "ดูรายละเอียด" ที่คนที่เสร็จแล้ว เพื่อเปิดหน้าประวัติการรักษาของคนนั้น</span>
              </div>
              <GridTable cols={COLS} minWidth={700} head={['ช่องเวลา', 'ผู้ป่วย', 'นักกายภาพ', 'ติดตามการรักษา', '']}>
                {SLOTS.map((x, i) => {
                  const a = trainingAt(appts, sel, x.s)
                  const st = a ? queueState(a, today) : null
                  return (
                    <div key={x.s}>
                      {i === LUNCH_BEFORE && (
                        <GridRow cols={COLS}><span className="text-rx-muted">12:00 – 13:00</span><span className="text-rx-muted">พักกลางวัน</span><span /><span /><span /></GridRow>
                      )}
                      <GridRow cols={COLS}>
                        <span className="font-semibold">{slotLabel(x.s)}</span>
                        <div className="flex min-w-0 flex-col">
                          <span className={a ? 'font-semibold' : 'text-rx-muted'}>{a ? fullName(a.patient_name, a.patient_lastname) : 'ว่าง'}</span>
                          {a && <span className="text-[12px] text-rx-muted">HN {a.patient_id}</span>}
                        </div>
                        <span>{a ? ptName(a.therapist_name) : '–'}</span>
                        <div>{st && <Badge state={st} />}</div>
                        <div>
                          {a && st === 'done' && (
                            <button type="button" onClick={() => onOpenPatient(a.patient_id)} className="inline-flex h-10 items-center whitespace-nowrap rounded-[10px] border border-rx-tint-2 bg-white px-3.5 text-[13px] font-semibold text-rx-accent-ink">ดูรายละเอียด</button>
                          )}
                          {a && st === 'notyet' && (
                            <button type="button" disabled={busy === a.appointment_id} onClick={() => checkIn(a)} className="h-10 whitespace-nowrap rounded-[10px] border border-rx-line bg-white px-3.5 text-[13px] font-semibold disabled:opacity-60">
                              {busy === a.appointment_id ? 'กำลังรับคิว...' : 'รับคิว'}
                            </button>
                          )}
                        </div>
                      </GridRow>
                    </div>
                  )
                })}
              </GridTable>
            </>
          )}
        </div>
      ) : (
        <WeekView mon={mon} appts={appts} today={today} onOpenDay={d => { setSel(d); setView('day') }} />
      )}
    </>
  )
}

function WeekView({ mon, appts, today, onOpenDay }: { mon: Date; appts: PatientAppointment[]; today: Date; onOpenDay: (d: Date) => void }) {
  const days = Array.from({ length: 6 }, (_, i) => addDays(mon, i))
  const rows = days.map(d => {
    const items = appts
      .filter(a => isTraining(a) && a.status !== 'CANCELLED' && sameDay(new Date(a.appointment_date), d))
      .map(a => ({ a, st: queueState(a, today) }))
    return { d, items, done: items.filter(x => x.st === 'done').length, no: items.filter(x => x.st === 'noshow').length }
  })
  const total = rows.reduce((s, r) => s + r.items.length, 0)
  const sun = addDays(mon, 6)
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[220px] text-center text-[16px] font-semibold">{dayMonth(mon)} – {dayMonth(sun)} {sun.getFullYear() + 543}</span>
        <span className="ml-2 text-[13px] text-rx-muted">รวม {total} คิว · เสร็จ {rows.reduce((s, r) => s + r.done, 0)} · ไม่มา {rows.reduce((s, r) => s + r.no, 0)}</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] items-start gap-3">
        {rows.map(r => (
          <div key={r.d.toISOString()} className="flex flex-col gap-1.5 rounded-lg bg-white px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold">{thaiDate(r.d)}{sameDay(r.d, today) ? ' · วันนี้' : ''}</span>
              <button type="button" onClick={() => onOpenDay(r.d)} className="h-8 rounded-lg border border-rx-line bg-white px-2.5 text-[12px] font-semibold text-rx-accent-ink">ดูรายวัน</button>
            </div>
            <span className="text-[12px] text-rx-muted">{r.items.length} คิว · เสร็จ {r.done}{r.no ? ` · ไม่มา ${r.no}` : ''} · ว่าง {SLOTS.length - r.items.filter(x => x.st !== 'noshow').length} ช่อง</span>
            {r.items.map(({ a, st }) => (
              <div key={a.appointment_id} className="flex items-center gap-2.5 border-t border-rx-divider py-1.5 text-[13px]">
                <span className="w-11 font-semibold">{apptSlot(a)}</span>
                <span className="min-w-0 flex-1 truncate">{fullName(a.patient_name, a.patient_lastname)}</span>
                <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: BADGE[st][1], color: BADGE[st][2] }}>{BADGE[st][0]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
