import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import type { AuthUser, Patient, PatientAppointment, Therapist } from '../../types'
import {
  api, list, rangeQuery, SLOTS, LUNCH_BEFORE, slotLabel, slotDate, slotEnd, holdsSlot, apptSlot, addDays, startOfDay, sameDay, mondayOf,
  isoDate, fromIsoDate, thaiDate, dayMonth, hhmm, isTraining, trainingAt, queueState, BADGE,
  ptName, fullName,
} from '../../lib/clinic'
import { Badge, GridTable, GridRow, Loading, ErrorText, ThaiCalendarPicker, selectCls } from '../../components/ui'

interface Props { user: AuthUser; onOpenPatient: (patientId: string) => void }

const COLS = '120px minmax(0, 1.6fr) minmax(0, 1fr) 120px 150px'

export default function QueuePage({ onOpenPatient }: Props) {
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

  const isToday = sameDay(sel, today)
  const dayAppts = appts.filter(a => sameDay(new Date(a.appointment_date), sel))
  const assessments = dayAppts.filter(a => a.appointment_type === 'ASSESSMENT' && a.status !== 'CANCELLED')
  // เพิ่มเข้าคิวได้เฉพาะผู้ป่วยที่ลงทะเบียน (เปิดเคส) วันนี้และยังไม่มีนัด · คนที่มีนัดแล้วขึ้นในช่องของนัดนั้นเอง
  // ผู้ป่วยใหม่ (รอประเมิน) → เข้าคิวประเมิน ไม่ใช้กระดาน · ผ่านการประเมินแล้ว → เข้าคิวฝึก
  const [patients, setPatients] = useState<Patient[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [adding, setAdding] = useState<{ s: string; patientId: string; otId: string } | null>(null)
  const [booked, setBooked] = useState<PatientAppointment[]>([]) // นัดตั้งแต่วันนี้เป็นต้นไป ใช้ดูว่าใครมีนัดแล้ว
  useEffect(() => {
    list<Patient>('/api/patients?status=ALL').then(setPatients)
    list<Therapist>('/api/therapists').then(setTherapists)
    list<PatientAppointment>(`/api/appointments?${rangeQuery(today, addDays(today, 366))}`).then(setBooked)
  }, [])
  const heldToday = dayAppts.filter(holdsSlot)
  const pending = new Set([...booked, ...dayAppts].filter(a => ['SCHEDULED', 'CHECKED_IN', 'IN_PROGRESS'].includes(a.status)).map(a => a.patient_id))
  const candidates = patients.filter(p => (p.case_status === 'ACTIVE' || p.case_status === 'PENDING_ASSESSMENT') && !!p.case_opened_at && sameDay(new Date(p.case_opened_at), today) && !pending.has(p.patient_id) && !heldToday.some(a => a.patient_id === p.patient_id))
  const freeOts = (s: string) => therapists.filter(t => !heldToday.some(a => a.ot_id === t.ot_id && apptSlot(a) === s))
  const slotOpen = (s: string) => isToday && slotDate(sel, slotEnd(s)) > new Date()
  const openAdd = (s: string) => { setAdding({ s, patientId: '', otId: '' }); setError('') }
  const pickPatient = (patientId: string) => {
    if (!adding) return
    const p = patients.find(x => x.patient_id === patientId)
    const primary = p?.primary_ot_id && freeOts(adding.s).some(t => t.ot_id === p.primary_ot_id) ? p.primary_ot_id : ''
    setAdding({ ...adding, patientId, otId: primary || adding.otId })
  }
  const addToQueue = async () => {
    if (!adding) return
    setBusy('add'); setError('')
    try {
      await api('/api/appointments', { method: 'POST', body: { walkIn: true, patientId: adding.patientId, otId: adding.otId, appointmentDate: slotDate(sel, adding.s).toISOString() } })
      setAdding(null); await load()
      list<PatientAppointment>(`/api/appointments?${rangeQuery(today, addDays(today, 366))}`).then(setBooked)
    } catch (e) { setError((e as Error).message) }
    setBusy(null)
  }

  const tgl = (on: boolean) => `h-11 px-4 text-[13px] font-semibold ${on ? 'bg-rx-tint text-rx-accent-ink' : 'bg-white text-rx-ink'}`

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="m-0 text-[28px] font-bold leading-tight">คิวผู้ป่วย</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-rx-line bg-white">
            <button type="button" onClick={() => setView('day')} className={tgl(view === 'day')}>รายวัน</button>
            <button type="button" onClick={() => setView('week')} className={tgl(view === 'week')}>รายสัปดาห์</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 rx-card py-1.5 pl-3 pr-2">
            <label htmlFor="jump" className="text-[13px] text-rx-muted">เลือกวันที่</label>
            <ThaiCalendarPicker id="jump" value={isoDate(sel)} onChange={iso => setSel(fromIsoDate(iso))} />
            <button type="button" onClick={() => setSel(today)} className="h-10 whitespace-nowrap rounded-full rx-glass-control px-3.5 text-[13px] font-semibold">วันนี้</button>
          </div>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>
      {loading ? <Loading /> : view === 'day' ? (
        <div className="flex flex-col gap-[18px]">
            <>
              {isToday && (() => {
                const now = dayAppts.find(a => isTraining(a) && a.status === 'IN_PROGRESS')
                return (
                  <div className="flex flex-wrap items-center gap-4 rx-card px-[22px] py-[18px]">
                    <div className="flex flex-[1_1_260px] flex-col gap-1">
                      <span className="text-[12px] text-rx-muted">ผู้ที่กำลังฝึก</span>
                      <span className="text-[20px] font-semibold">{now ? fullName(now.patient_name, now.patient_lastname) : 'ไม่มีผู้ป่วยกำลังฝึก'}</span>
                      {now && <span className="text-[13px] text-rx-muted">HN {now.patient_id} · ช่อง {slotLabel(apptSlot(now))} · {ptName(now.treated_by_name ?? now.therapist_name)}{now.device_name ? ` · กระดาน ${now.device_name}` : ''}</span>}
                    </div>
                    {now && <Badge state="now" />}
                  </div>
                )
              })()}

              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[15px] font-semibold">ตารางเวลา {thaiDate(sel)}</span>
                <span className="text-[12px] text-rx-muted">นัดประเมินผู้ป่วยใหม่แสดงในช่องเวลาที่นัดกับนักกายภาพ · ไม่ใช้กระดาน</span>
              </div>
              <GridTable cols={COLS} minWidth={700} head={['ช่องเวลา', 'ผู้ป่วย', 'นักกายภาพ', 'สถานะ', '']}>
                {SLOTS.map((x, i) => {
                  const a = trainingAt(appts, sel, x.s)
                  const st = a ? queueState(a, today) : null
                  const ass = assessments.filter(v => apptSlot(v) === x.s)
                  const canAdd = !a && slotOpen(x.s)
                  // ช่องที่มีแค่นัดประเมิน → แสดงนัดประเมินเป็นแถวของช่องนั้นเลย ไม่ขึ้น "ว่าง" ให้สับสน
                  const boardRow = !!a || ass.length === 0
                  return (
                    <div key={x.s}>
                      {i === LUNCH_BEFORE && (
                        <GridRow cols={COLS}><span className="text-rx-muted">12:00 – 13:00</span><span className="text-rx-muted">พักกลางวัน</span><span /><span /><span /></GridRow>
                      )}
                      {boardRow && <GridRow cols={COLS}>
                        <span className="font-semibold">{slotLabel(x.s)}</span>
                        <div className="flex min-w-0 flex-col">
                          <span className={a ? 'font-semibold' : 'text-rx-muted'}>{a ? fullName(a.patient_name, a.patient_lastname) : 'ว่าง'}</span>
                          {a && <span className="text-[12px] text-rx-muted">HN {a.patient_id}</span>}
                        </div>
                        <span>{a ? ptName(a.therapist_name) : '–'}</span>
                        <div>{st && <Badge state={st} />}</div>
                        <div>
                          {a && (st === 'done' || st === 'review') && (
                            <button type="button" onClick={() => onOpenPatient(a.patient_id)} className="inline-flex h-10 items-center whitespace-nowrap rounded-full rx-glass-control px-3.5 text-[13px] font-semibold text-rx-accent-ink">ดูรายละเอียด</button>
                          )}
                          {canAdd && adding?.s !== x.s && (
                            <button type="button" onClick={() => openAdd(x.s)} className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full rx-glass-control px-3.5 text-[13px] font-semibold text-rx-accent-ink">
                              <Plus size={15} />เพิ่มเข้าคิว
                            </button>
                          )}
                        </div>
                      </GridRow>}

                      {adding?.s === x.s && (() => {
                        const ots = freeOts(x.s)
                        return (
                          <div className="flex flex-wrap items-end gap-3 border-t border-rx-divider bg-rx-tint px-[18px] py-3.5">
                            <label className="flex min-w-[240px] flex-[2_1_240px] flex-col gap-1 text-[13px] font-semibold">
                              ผู้ป่วย
                              <select className={selectCls} value={adding.patientId} onChange={e => pickPatient(e.target.value)}>
                                <option value="">เลือกผู้ป่วย</option>
                                {candidates.map(p => <option key={p.patient_id} value={p.patient_id}>{fullName(p.first_name, p.last_name)} · HN {p.patient_id}{p.case_status === 'PENDING_ASSESSMENT' ? ' · ผู้ป่วยใหม่ (ประเมิน)' : ''}</option>)}
                              </select>
                            </label>
                            <label className="flex min-w-[200px] flex-[1_1_200px] flex-col gap-1 text-[13px] font-semibold">
                              นักกายภาพ (ว่างช่องนี้)
                              <select className={selectCls} value={adding.otId} onChange={e => setAdding({ ...adding, otId: e.target.value })}>
                                <option value="">เลือกนักกายภาพ</option>
                                {ots.map(t => <option key={t.ot_id} value={t.ot_id}>{ptName(t.first_name)}</option>)}
                              </select>
                            </label>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => setAdding(null)} className="h-11 rounded-full rx-glass-control px-4 text-[13px] font-semibold">ยกเลิก</button>
                              <button type="button" disabled={!adding.patientId || !adding.otId || busy === 'add'} onClick={addToQueue} className="h-11 rounded-full bg-rx-accent px-4 text-[13px] font-semibold text-white disabled:opacity-60">
                                {busy === 'add' ? 'กำลังเพิ่ม...' : `เพิ่มเข้าคิว ${x.s} น.`}
                              </button>
                            </div>
                            {candidates.length === 0 && <span className="w-full text-[12px] text-rx-muted">ไม่มีผู้ป่วยที่ลงทะเบียนวันนี้และยังไม่มีนัด · ผู้ป่วยที่มีนัดแล้วจะขึ้นในช่องเวลาของนัดนั้น</span>}
                          </div>
                        )
                      })()}

                      {ass.map((v, j) => {
                        return (
                          <GridRow key={v.appointment_id} cols={COLS}>
                            <div className="flex flex-col">
                              {!boardRow && j === 0 && <span className="font-semibold">{slotLabel(x.s)}</span>}
                              <span className="text-[12px] text-rx-muted">นัดประเมิน</span>
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <span className="font-semibold">{fullName(v.patient_name, v.patient_lastname)}</span>
                              <span className="text-[12px] text-rx-muted">HN {v.patient_id} · ผู้ป่วยใหม่ส่งประเมิน{v.checked_in_at ? ` · ลงทะเบียน ${hhmm(new Date(v.checked_in_at))}` : ''}</span>
                            </div>
                            <span>{ptName(v.therapist_name)}</span>
                            <div>
                              <Badge state={queueState(v, today)} />
                            </div>
                            <div>
                            </div>
                          </GridRow>
                        )
                      })}
                    </div>
                  )
                })}
              </GridTable>
            </>
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
    return { d, items, done: items.filter(x => x.st === 'done' || x.st === 'review').length, no: items.filter(x => x.st === 'noshow').length }
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
          <div key={r.d.toISOString()} className="flex flex-col gap-1.5 rx-card px-4 py-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold">{thaiDate(r.d)}{sameDay(r.d, today) ? ' · วันนี้' : ''}</span>
              <button type="button" onClick={() => onOpenDay(r.d)} className="h-8 rounded-full rx-glass-control px-2.5 text-[12px] font-semibold text-rx-accent-ink">ดูรายวัน</button>
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
