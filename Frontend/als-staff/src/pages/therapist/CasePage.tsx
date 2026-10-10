import { useEffect, useState } from 'react'
import { Check, Lock, Printer } from 'lucide-react'
import type { AuthUser, Device, PatientAppointment, TherapySession } from '../../types'
import {
  api, list, rangeQuery, SLOTS, SLOT_MIN, slotDate, slotLabel, apptSlot, addDays, startOfDay, sameDay, thaiDate, thaiShort, dayMonth, hhmm,
  isClosedDay, isTraining, holdsSlot, trainingAt, queueState, BADGE, setsOfVisit, avg, STAGES, STAGE_LABEL, stageLabel, ptName, fullName,
  effectiveSoap, SOAP_FIELDS, SOAP_LABEL, type SoapField,
} from '../../lib/clinic'
import { PatientHeader, VisitCard } from '../../components/VisitHistory'
import { useCase, pastVisits, activePrograms } from '../../lib/useCase'
import { BackLink, Badge, Btn, DayPicker, ErrorText, Field, Loading, SlotGrid, SlotLegend, Stat, inputCls, selectCls, textareaCls } from '../../components/ui'

interface Props { user: AuthUser; patientId: string; onBack: () => void }

type Tab = 'today' | 'progress' | 'history'
const CLOSE_REASONS = ['อาการดีขึ้น ไม่ต้องรักษาต่อ', 'ครบโปรแกรมตามแผน', 'ส่งต่อสถานพยาบาลอื่น', 'ผู้ป่วยขอยุติการรักษา']
const LIVE_POLL_MS = 3000

export default function CasePage({ user, patientId, onBack }: Props) {
  const data = useCase(patientId)
  const [tab, setTab] = useState<Tab>('today')
  const { patient, appts, programs, loading } = data

  if (loading) return <Loading />
  if (!patient) return <><BackLink onClick={onBack}>เคสของฉัน</BackLink><Loading text="ไม่พบข้อมูลผู้ป่วย" /></>

  const today = startOfDay(new Date())
  const todayAppt = appts
    .filter(a => isTraining(a) && holdsSlot(a) && sameDay(new Date(a.appointment_date), today))
    .sort((a, b) => ['IN_PROGRESS', 'CHECKED_IN', 'SCHEDULED', 'COMPLETED'].indexOf(a.status) - ['IN_PROGRESS', 'CHECKED_IN', 'SCHEDULED', 'COMPLETED'].indexOf(b.status))[0]
  const st = todayAppt ? queueState(todayAppt, today) : null
  const starts = activePrograms(programs).map(p => p.assigned_date).filter(Boolean).sort()
  const courseStart = starts[0] ? new Date(starts[0]) : patient.assessed_at ? new Date(patient.assessed_at) : null

  const tabBtn = (k: Tab, label: string) => (
    <button key={k} type="button" onClick={() => setTab(k)} className={`flex min-h-11 items-center whitespace-nowrap px-4 text-[14px] ${tab === k ? 'border-b-2 border-rx-accent font-semibold text-rx-accent-ink' : 'text-rx-muted'}`}>{label}</button>
  )

  return (
    <>
      <BackLink onClick={onBack}>เคสของฉัน</BackLink>
      <PatientHeader
        patient={patient}
        programs={programs}
        badge={patient.case_status === 'CLOSED'
          ? <Badge label="เสร็จสิ้นการรักษา" />
          : st && st !== 'booked' ? <Badge state={st} label={`${BADGE[st][0]} · ช่อง ${slotLabel(apptSlot(todayAppt!))}`} /> : undefined}
        extra={[courseStart ? `เริ่มคอร์ส ${thaiShort(courseStart)}` : '']}
      />
      <nav className="flex gap-1 overflow-x-auto border-b border-rx-line">
        {tabBtn('today', 'วันนี้')}{tabBtn('progress', 'พัฒนาการ')}{tabBtn('history', 'ประวัติการรักษา')}
      </nav>
      {tab === 'today' && <TodayTab user={user} data={data} todayAppt={todayAppt} />}
      {tab === 'progress' && <ProgressTab data={data} />}
      {tab === 'history' && <HistoryTab data={data} />}
    </>
  )
}

/* =========================== วันนี้ =========================== */

function TodayTab({ user, data, todayAppt }: { user: AuthUser; data: ReturnType<typeof useCase>; todayAppt?: PatientAppointment }) {
  const { patient, sessions, programs, amendments, reload } = data
  const [device, setDevice] = useState<Device | null>(null)
  const [soap, setSoap] = useState({ s: '', o: '', a: '', p: '' })
  const [confirmed, setConfirmed] = useState(false)
  const [amend, setAmend] = useState<{ field: SoapField; text: string; reason: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setSoap({ s: todayAppt?.soap_s ?? todayAppt?.symptoms_today ?? '', o: todayAppt?.soap_o ?? '', a: todayAppt?.soap_a ?? '', p: todayAppt?.soap_p ?? '' })
    setConfirmed(false); setAmend(null)
  }, [todayAppt?.appointment_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ระหว่างรอเชื่อมต่อ / กำลังฝึก ดึงค่าสดจากกระดานและสถานะนัดถี่ ๆ
  const live = todayAppt?.status === 'IN_PROGRESS' || todayAppt?.status === 'CHECKED_IN'
  useEffect(() => {
    if (!todayAppt?.device_id) { setDevice(null); return }
    const fetchDev = () => list<Device>('/api/devices').then(ds => setDevice(ds.find(d => d.device_id === todayAppt.device_id) ?? null))
    fetchDev()
    if (!live) return
    const t = setInterval(() => { fetchDev(); reload() }, LIVE_POLL_MS)
    return () => clearInterval(t)
  }, [todayAppt?.device_id, live]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!patient) return null
  const sets = todayAppt ? setsOfVisit(sessions, todayAppt) : []
  const totalSets = activePrograms(programs)[0]?.session_per_day ?? 0
  const running = todayAppt?.status === 'IN_PROGRESS'
  const connected = device?.connection_status === 'CONNECTED'
  const counting = running && connected && device?.live_status === 'RUNNING'
  const liveReps = counting ? device?.live_reps ?? 0 : null
  const lastFatigue = [...sessions].sort((a, b) => b.session_date.localeCompare(a.session_date)).find(s => s.fatigue_level != null)?.fatigue_level
  const saved = !!todayAppt?.soap_saved_at
  const current = todayAppt ? effectiveSoap(todayAppt, amendments) : null
  const myAmendments = amendments.filter(m => m.appointment_id === todayAppt?.appointment_id)

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true); setError(''); setMsg('')
    try { await fn(); await reload(); if (done) setMsg(done) } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  const patchAppt = (body: Record<string, unknown>) => api('/api/appointments', { method: 'PATCH', body: { appointmentId: todayAppt!.appointment_id, ...body } })

  const pullFromBoard = () => {
    if (!sets.length && liveReps == null) return
    const parts = sets.map((s, i) => `เซต ${i + 1} ทำได้ ${s.total_reps} ครั้ง${s.total_reps ? ` เฉลี่ย ${Math.round(s.duration_sec / s.total_reps)} วินาทีต่อครั้ง` : ''}`)
    if (liveReps != null) parts.push(`เซต ${sets.length + 1} กำลังฝึก ${liveReps} ครั้ง`)
    setSoap(x => ({ ...x, o: `ดันกระดาน ${parts.join(' · ')}` }))
  }

  return (
    <>
      <ErrorText>{error}</ErrorText>
      {msg && <div className="rounded-lg bg-[#E4F5EC] px-4 py-2.5 text-[13px] font-semibold text-[#145C38]">{msg}</div>}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
          <div className="flex flex-col gap-3 rounded-lg bg-white p-[18px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold">การฝึกสด</span>
              {todayAppt?.device_id && (
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-medium ${running && connected ? 'bg-[#E4F5EC] text-[#145C38]' : 'bg-rx-soft text-rx-muted'}`}>
                  <span className={`h-[7px] w-[7px] rounded-full ${running && connected ? 'bg-[#1F9D5C]' : 'bg-rx-faint'}`} />{todayAppt.device_name ?? todayAppt.device_id}
                </span>
              )}
            </div>

            {!todayAppt && <span className="text-[14px] text-rx-muted">วันนี้ไม่มีนัดฝึกของผู้ป่วยคนนี้</span>}
            {todayAppt?.status === 'SCHEDULED' && <span className="text-[14px] text-rx-muted">ผู้ป่วยยังไม่ได้รับเข้าคิวที่เวชระเบียน</span>}

            {todayAppt?.status === 'CHECKED_IN' && (
              <div className="flex flex-col gap-3">
                <span className="text-[13px] text-rx-muted">
                  {todayAppt.called_at ? `เวชระเบียนเรียกคิวแล้ว ${hhmm(new Date(todayAppt.called_at))} น. · ยืนยันตัวผู้ป่วยแล้วเชื่อมต่อกระดาน` : 'มาแล้ว รอเวชระเบียนเรียกคิว'}
                </span>
                {/* กันความผิดพลาดที่อันตรายที่สุดของเครื่องเดียวหลายคน: เชื่อมผิดคน */}
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-rx-tint-2 bg-rx-tint px-3.5 py-3">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-[#4D53E0]" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                  <span className="flex flex-col">
                    <span className="text-[16px] font-semibold">{fullName(patient.first_name, patient.last_name)} · HN {patient.patient_id}</span>
                    <span className="text-[12px] text-rx-accent-deep">ยืนยันว่าชื่อและ HN ตรงกับผู้ป่วยที่อยู่ตรงหน้า</span>
                  </span>
                </label>
                <button
                  type="button"
                  disabled={busy || !confirmed || !todayAppt.called_at}
                  onClick={() => run(() => patchAppt({ action: 'START', treatedBy: user.ot_id, confirmPatientId: patient.patient_id }), 'เชื่อมต่อกระดานแล้ว · เริ่มรับค่าจากบอร์ด')}
                  className="h-[46px] rounded-[10px] bg-rx-accent text-[14px] font-semibold text-white disabled:bg-rx-soft disabled:text-rx-muted"
                >
                  {!todayAppt.called_at ? 'รอเวชระเบียนเรียกคิว' : 'เชื่อมต่อกระดาน'}
                </button>
              </div>
            )}

            {running && (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-[48px] font-semibold leading-none">{liveReps ?? sets[sets.length - 1]?.total_reps ?? 0}</span>
                  <span className="text-[16px] text-rx-muted">ครั้ง · เซต {Math.max(1, sets.length + (counting ? 1 : 0))}{totalSets ? ` จาก ${totalSets}` : ''}</span>
                </div>
                <span className="text-[13px] text-rx-muted">
                  {!connected ? 'กระดานยังไม่ส่งสัญญาณ · ตรวจสอบพาวเวอร์แบงก์และ WiFi' : counting ? 'กำลังนับ · ไม่มีจำนวนขั้นต่ำ' : sets.length ? `จบเซต ${sets.length} แล้ว · พักตามอาการก่อนเริ่มเซตถัดไป` : 'รอกระดานเริ่มนับเซตแรก'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" disabled={busy || counting || !connected} onClick={() => run(() => patchAppt({ action: 'NEXT_SET' }), 'สั่งกระดานเริ่มเซตถัดไปแล้ว')} className="h-[46px] rounded-[10px] bg-rx-accent text-[14px] font-semibold text-white disabled:bg-rx-soft disabled:text-rx-muted">เริ่มเซตถัดไป</button>
                  <button type="button" disabled={busy} onClick={() => run(() => patchAppt({ action: 'COMPLETE' }), 'จบการฝึกแล้ว · กระดานว่างสำหรับคนถัดไป · บันทึก SOAP ต่อได้เลย')} className="h-[46px] rounded-[10px] border-[1.5px] border-rx-accent bg-white text-[14px] font-semibold text-rx-accent-ink disabled:opacity-60">จบการฝึก</button>
                </div>
                <span className="text-[12px] text-rx-muted">จบการฝึกแล้วกระดานจะหยุดรับค่าของผู้ป่วยคนนี้ และว่างให้คนถัดไปทันที</span>
              </>
            )}

            {todayAppt?.status === 'COMPLETED' && (
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[#145C38]">จบการฝึกแล้ว {todayAppt.completed_at ? hhmm(new Date(todayAppt.completed_at)) : ''} น. · ตัดการเชื่อมต่อกระดานแล้ว</span>
                {sets.length > 0 && <span className="text-[13px] text-rx-muted">{sets.map((s, i) => `เซต ${i + 1}: ${s.total_reps} ครั้ง`).join(' · ')}</span>}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2.5 rounded-lg bg-white px-[18px] py-4">
            <span className="text-[15px] font-semibold">ข้อมูลจากผู้ป่วย</span>
            <div className="flex justify-between text-[14px]"><span className="text-rx-muted">ความเหนื่อยหลังเซตล่าสุด</span><span className="font-semibold">{lastFatigue != null ? `${lastFatigue} / 5` : '–'}</span></div>
          </div>
        </div>

        <div className="flex min-w-0 flex-[2_1_440px] flex-col gap-3.5 rounded-lg bg-white px-5 py-[18px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold">บันทึกการรักษา (SOAP)</span>
            {saved ? <Badge label={`บันทึกผลแล้ว ${hhmm(new Date(todayAppt!.soap_saved_at!))}`} bg="#E4F5EC" fg="#145C38" /> : <Badge label="ยังไม่บันทึกผล" />}
          </div>
          {!todayAppt ? <span className="text-[14px] text-rx-muted">บันทึก SOAP ได้ในวันที่ผู้ป่วยมาตามนัด</span> : saved && current ? (
            <>
              {SOAP_FIELDS.map(k => (
                <div key={k} className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold">{SOAP_LABEL[k]}{k === 'P' && <span className="ml-2 rounded-lg bg-rx-tint px-2 py-0.5 text-[12px] font-medium text-rx-accent-ink">ผู้ป่วยเห็นส่วนนี้</span>}</span>
                  <span className="whitespace-pre-line rounded-[10px] bg-rx-bg px-3 py-2.5 text-[14px]">{current[k] || '–'}</span>
                </div>
              ))}
              {myAmendments.map(m => (
                <div key={m.amendment_id} className="rounded-lg bg-[#FFF0D9] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#8C420A]">
                  บันทึกแก้ไขเพิ่มเติม · {ptName(m.amended_by_name)} {hhmm(new Date(m.amended_at))} — แก้ {m.field} จาก "{m.old_value || '–'}" เป็น "{m.new_value || '–'}" · เหตุผล: {m.reason} · ฉบับเดิมยังเก็บไว้
                </div>
              ))}
              {amend ? (
                <div className="flex flex-col gap-2.5 border-t border-rx-divider pt-3">
                  <div className="flex flex-wrap gap-2.5">
                    <Field label="ช่องที่แก้" htmlFor="af" className="w-[180px]">
                      <select id="af" className={selectCls} value={amend.field} onChange={e => { const f = e.target.value as SoapField; setAmend({ ...amend, field: f, text: current[f] }) }}>
                        {SOAP_FIELDS.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </Field>
                    <Field label="เหตุผลที่แก้" htmlFor="ar" className="flex-[1_1_240px]">
                      <input id="ar" className={inputCls} value={amend.reason} onChange={e => setAmend({ ...amend, reason: e.target.value })} placeholder="เช่น กรอกผิด" />
                    </Field>
                  </div>
                  <textarea aria-label="ข้อความใหม่" rows={3} className={textareaCls} value={amend.text} onChange={e => setAmend({ ...amend, text: e.target.value })} />
                  <div className="flex justify-end gap-2">
                    <Btn variant="outline" size="sm" onClick={() => setAmend(null)}>ยกเลิก</Btn>
                    <Btn size="sm" disabled={busy || !amend.reason.trim()} onClick={() => run(async () => {
                      await api('/api/soap-amendments', { method: 'POST', body: { appointmentId: todayAppt.appointment_id, field: amend.field, newValue: amend.text, reason: amend.reason, amendedBy: user.users_id } })
                      setAmend(null)
                    }, 'บันทึกแก้ไขแล้ว · ฉบับเดิมยังเก็บไว้')}>บันทึกแก้ไข</Btn>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5 border-t border-rx-divider pt-1.5">
                  <span className="flex-[1_1_220px] text-[12px] text-rx-muted">บันทึกผลแล้วแก้ตรงไม่ได้ · แก้ด้วยบันทึกแก้ไขเพิ่มเติม (เก็บฉบับเดิม เหตุผล และผู้แก้)</span>
                  <Btn variant="outline" size="sm" onClick={() => setAmend({ field: 'A', text: current.A, reason: '' })}>บันทึกแก้ไขเพิ่มเติม</Btn>
                </div>
              )}
            </>
          ) : (
            <>
              <Field label="S · อาการที่ผู้ป่วยเล่า" htmlFor="s"><textarea id="s" rows={2} className={textareaCls} value={soap.s} onChange={e => setSoap(x => ({ ...x, s: e.target.value }))} /></Field>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="o" className="text-[13px] font-semibold">O · สิ่งที่ตรวจวัดได้</label>
                  <button type="button" onClick={pullFromBoard} className="h-8 rounded-lg border border-rx-line bg-white px-2.5 text-[12px]">ดึงค่าจากกระดาน</button>
                </div>
                <textarea id="o" rows={2} className={textareaCls} value={soap.o} onChange={e => setSoap(x => ({ ...x, o: e.target.value }))} />
              </div>
              <Field label="A · การประเมินของนักกายภาพ" htmlFor="a"><textarea id="a" rows={2} className={textareaCls} placeholder="สรุปการประเมินจากข้อมูลด้านบน · อาการคงที่ถือเป็นผลที่ดี" value={soap.a} onChange={e => setSoap(x => ({ ...x, a: e.target.value }))} /></Field>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="p" className="text-[13px] font-semibold">P · แผนและคำแนะนำ</label>
                  <span className="rounded-lg bg-rx-tint px-2 py-0.5 text-[12px] font-medium text-rx-accent-ink">ผู้ป่วยจะเห็นส่วนนี้</span>
                </div>
                <textarea id="p" rows={3} className={textareaCls} placeholder="คำแนะนำที่จะไปขึ้นหน้าคำแนะนำของผู้ป่วย" value={soap.p} onChange={e => setSoap(x => ({ ...x, p: e.target.value }))} />
              </div>
              <div className="flex flex-wrap items-center gap-2.5 border-t border-rx-divider pt-1.5">
                <span className="flex-[1_1_220px] text-[12px] text-rx-muted">บันทึกผลทันทีหลังจบการฝึก ไม่ต้องลงนามย้อนหลัง · บันทึกแล้วแก้ได้ด้วยบันทึกแก้ไขเพิ่มเติมเท่านั้น</span>
                <Btn disabled={busy || !['IN_PROGRESS', 'COMPLETED'].includes(todayAppt.status)} onClick={() => run(() => patchAppt({ soapS: soap.s, soapO: soap.o, soapA: soap.a, soapP: soap.p, saveSoap: true }), 'บันทึกผลการรักษาแล้ว')}>บันทึกผลการรักษา</Btn>
              </div>
            </>
          )}
        </div>
      </div>
      <AfterCard user={user} data={data} />
    </>
  )
}

/** หลังจบการฝึก: ลงนัดครั้งถัดไป หรือเสร็จสิ้นการรักษา */
function AfterCard({ user, data }: { user: AuthUser; data: ReturnType<typeof useCase> }) {
  const { patient, appts, reload } = data
  const today = startOfDay(new Date())
  const [mode, setMode] = useState<'next' | 'finish'>('next')
  const [center, setCenter] = useState<PatientAppointment[]>([])
  const [day, setDay] = useState<Date | null>(null)
  const [slot, setSlot] = useState('')
  const [close, setClose] = useState({ reason: CLOSE_REASONS[0], stage: patient?.current_stage ?? 'EARLY', summary: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadCenter = () => list<PatientAppointment>(`/api/appointments?${rangeQuery(addDays(today, 1), addDays(today, 15))}`).then(setCenter)
  useEffect(() => { loadCenter() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!patient) return null
  const name = patient.first_name?.trim() ?? ''
  const upcoming = appts.filter(a => isTraining(a) && a.status === 'SCHEDULED' && new Date(a.appointment_date) >= addDays(today, 1)).sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))[0]
  const closed = patient.case_status === 'CLOSED'

  const days: Date[] = []
  for (let o = 1; days.length < 6 && o < 15; o++) { const d = addDays(today, o); if (!isClosedDay(d)) days.push(d) }
  const hasOwn = (d: Date) => center.some(a => a.patient_id === patient.patient_id && holdsSlot(a) && sameDay(new Date(a.appointment_date), d))
  const freeCount = (d: Date) => SLOTS.filter(x => !trainingAt(center, d, x.s)).length
  const firstFree = days.find(d => !hasOwn(d) && freeCount(d) > 0) ?? days[0]
  const selDay = day ?? firstFree
  const already = selDay ? hasOwn(selDay) : false
  const slots = selDay ? SLOTS.map(x => {
    const a = trainingAt(center, selDay, x.s)
    return { s: x.s, label: slotLabel(x.s), free: !a && !already, meta: a ? (a.patient_id === patient.patient_id ? `นัดของ${name}อยู่แล้ว` : `ไม่ว่าง · ${ptName(a.therapist_name)}`) : already ? 'วันนี้มีนัดแล้ว' : 'ว่าง' }
  }) : []

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await fn(); await Promise.all([reload(), loadCenter()]) } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  const confirm = () => selDay && slot && run(async () => {
    await api('/api/appointments', { method: 'POST', body: { patientId: patient.patient_id, otId: user.ot_id, appointmentDate: slotDate(selDay, slot).toISOString(), appointmentType: 'TRAINING', durationMin: SLOT_MIN, createdBy: user.users_id } })
    setSlot('')
  })
  const tg = (on: boolean) => `h-[38px] rounded-md px-4 text-[13px] font-semibold ${on ? 'bg-rx-accent text-white' : 'bg-transparent text-rx-muted'}`
  const ud = upcoming ? new Date(upcoming.appointment_date) : null

  return (
    <div className="flex flex-col gap-3.5 rounded-lg bg-white px-6 py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[18px] font-semibold">หลังจบการฝึก · {patient.first_name} {patient.last_name}</span>
          <span className="text-[13px] text-rx-muted">ลงนัดครั้งถัดไป หรือเสร็จสิ้นการรักษาถ้าไม่ต้องมาต่อแล้ว</span>
        </div>
        <SlotLegend />
      </div>
      <ErrorText>{error}</ErrorText>

      {closed ? (
        <div className="flex flex-wrap items-center gap-3.5 rounded-lg bg-rx-soft px-[18px] py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rx-ink text-white"><Lock size={18} /></div>
          <div className="flex flex-[1_1_260px] flex-col">
            <span className="text-[16px] font-semibold">เสร็จสิ้นการรักษาแล้ว · ปิดเคส</span>
            <span className="text-[13px] text-rx-muted">{patient.close_reason} · ไม่มีนัดต่อ · ย้ายไปแท็บ "เสร็จสิ้นการรักษา" ในเคสของฉัน</span>
          </div>
          <Btn variant="outline" size="sm" disabled={busy} onClick={() => run(() => api('/api/patients', { method: 'PATCH', body: { patientId: patient.patient_id, action: 'REOPEN_CASE' } }))}>ยกเลิกการปิดเคส</Btn>
        </div>
      ) : (
        <>
          {!(mode === 'next' && upcoming) && (
            <div className="flex gap-1 self-start rounded-lg bg-rx-bg p-1">
              <button type="button" onClick={() => setMode('next')} className={tg(mode === 'next')}>ลงนัดครั้งถัดไป</button>
              <button type="button" onClick={() => setMode('finish')} className={tg(mode === 'finish')}>เสร็จสิ้นการรักษา</button>
            </div>
          )}
          {mode === 'next' && upcoming && ud && (
            <div className="flex flex-wrap items-center gap-3.5 rounded-lg bg-[#EAF7E3] px-[18px] py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#43BC13] text-white"><Check size={20} /></div>
              <div className="flex flex-[1_1_260px] flex-col">
                <span className="text-[16px] font-semibold text-[#145C38]">นัดครั้งถัดไปแล้ว: {thaiDate(ud)} · {slotLabel(apptSlot(upcoming))} น. · {ptName(upcoming.therapist_name)}</span>
                <span className="text-[13px] text-[#2E6B1A]">ผู้ป่วยเห็นนัดในแอปทันที · ช่องนี้ถูกจองกระดานไว้แล้ว</span>
              </div>
              <Btn variant="outline" size="sm" disabled={busy} onClick={() => run(() => api('/api/appointments', { method: 'PATCH', body: { appointmentId: upcoming.appointment_id, action: 'CANCEL' } }))}>เปลี่ยนนัด</Btn>
            </div>
          )}
          {mode === 'next' && !upcoming && (
            <div className="flex flex-col gap-3.5">
              <DayPicker days={days} selected={selDay ?? null} onPick={d => { setDay(d); setSlot('') }} meta={d => (hasOwn(d) ? 'มีนัดอยู่แล้ว' : freeCount(d) ? `ว่าง ${freeCount(d)} ช่อง` : 'เต็ม')} />
              <SlotGrid slots={slots} selected={slot} onPick={setSlot} />
              <div className="flex flex-wrap items-center gap-3 border-t border-rx-divider pt-3">
                <div className="flex flex-[1_1_260px] flex-col">
                  <span className="text-[12px] text-rx-muted">นัดที่จะลง</span>
                  <span className="text-[16px] font-semibold">{selDay && slot ? `${thaiDate(selDay)} · ${slotLabel(slot)} น.` : '–'}</span>
                </div>
                {selDay && slot ? <Btn size="lg" disabled={busy} onClick={confirm}>ยืนยันนัดครั้งถัดไป</Btn> : <Btn size="lg" disabled>เลือกช่องเวลาก่อน</Btn>}
              </div>
            </div>
          )}
          {mode === 'finish' && (
            <div className="flex flex-col gap-3.5">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Field label="เหตุผลที่จบการรักษา" htmlFor="fr">
                  <select id="fr" className={selectCls} value={close.reason} onChange={e => setClose(c => ({ ...c, reason: e.target.value }))}>{CLOSE_REASONS.map(r => <option key={r}>{r}</option>)}</select>
                </Field>
                <Field label="ระยะอาการตอนจบ" htmlFor="fd">
                  <select id="fd" className={selectCls} value={close.stage} onChange={e => setClose(c => ({ ...c, stage: e.target.value as typeof c.stage }))}>{STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
                </Field>
                <Field label="สรุปผลการรักษาทั้งคอร์ส" htmlFor="fs" className="sm:col-span-2">
                  <textarea id="fs" rows={3} className={textareaCls} placeholder="ผลลัพธ์โดยรวม จำนวนครั้งที่มา คำแนะนำการดูแลตัวเองต่อ" value={close.summary} onChange={e => setClose(c => ({ ...c, summary: e.target.value }))} />
                </Field>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rx-divider pt-3">
                <span className="text-[13px] text-rx-muted">ปิดเคสแล้วจะไม่มีการนัดต่อ · นัดที่ค้างอยู่จะถูกยกเลิก · ประวัติทั้งหมดยังดูได้ที่ "เคสของฉัน" แท็บเสร็จสิ้นการรักษา</span>
                <Btn variant="dark" size="lg" disabled={busy} onClick={() => run(() => api('/api/patients', { method: 'PATCH', body: { patientId: patient.patient_id, action: 'CLOSE_CASE', closeReason: close.reason, closeStage: close.stage, closeSummary: close.summary } }))}>ยืนยันเสร็จสิ้นการรักษา</Btn>
              </div>
            </div>
          )}
        </>
      )}
      <span className="text-[12px] text-rx-muted">กระดานมีเครื่องเดียว ใช้ร่วมกันทุกนักกายภาพ · ลงนัดได้เฉพาะช่องที่ยังไม่มีใครใช้ จึงไม่ชนกับผู้ป่วยหรือนักกายภาพคนอื่น</span>
    </div>
  )
}

/* =========================== พัฒนาการ =========================== */

function ProgressTab({ data }: { data: ReturnType<typeof useCase> }) {
  const { appts, sessions } = data
  const since = addDays(new Date(), -28)
  const recent = sessions.filter(s => new Date(s.session_date) >= since)
  const avgReps = avg(recent.map(s => s.total_reps))
  const reps = sessions.reduce((a, s) => a + s.total_reps, 0)
  const secPerRep = reps ? Math.round(sessions.reduce((a, s) => a + s.duration_sec, 0) / reps) : null
  const fat = avg(sessions.map(s => s.fatigue_level).filter((f): f is number => f != null))

  const visits = pastVisits(appts).filter(a => a.status !== 'NO_SHOW').slice(0, 8).reverse()
  const perVisit = visits.map(a => {
    const ss: TherapySession[] = setsOfVisit(sessions, a)
    return { a, reps: avg(ss.map(s => s.total_reps)), fat: avg(ss.map(s => s.fatigue_level).filter((f): f is number => f != null)) }
  })
  const mx = Math.max(1, ...perVisit.map(v => v.reps ?? 0))
  const label = (d: Date, i: number, arr: unknown[]) => (i === 0 || i === arr.length - 1 ? dayMonth(d) : String(d.getDate()))
  const fatRows = perVisit.filter(v => v.fat != null).slice(-5)

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Stat label="ครั้งเฉลี่ยต่อเซต (4 สัปดาห์)" value={avgReps != null ? avgReps.toFixed(1) : '–'} />
        <Stat label="เวลาเฉลี่ยต่อครั้ง" value={secPerRep != null ? `${secPerRep} วิ` : '–'} />
        <Stat label="ความเหนื่อยเฉลี่ย" value={fat != null ? `${fat.toFixed(1)} / 5` : '–'} />
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[3_1_420px] flex-col gap-3 rounded-lg bg-white px-[18px] py-4">
          <div className="flex items-center justify-between gap-2"><span className="text-[15px] font-semibold">จำนวนครั้ง</span><span className="text-[12px] text-rx-muted">ครั้งต่อเซต · ต่อการมาแต่ละครั้ง</span></div>
          {perVisit.length === 0 ? <span className="text-[14px] text-rx-muted">ยังไม่มีผลการฝึก</span> : (
            <>
              <div className="grid h-[170px] items-end gap-2.5 border-b border-rx-soft" style={{ gridTemplateColumns: `repeat(${perVisit.length}, minmax(0,1fr))` }}>
                {perVisit.map((v, i) => (
                  <div key={v.a.appointment_id} className="flex flex-col items-center gap-1">
                    <span className="text-[12px] text-rx-muted">{v.reps != null ? Math.round(v.reps * 10) / 10 : ''}</span>
                    <div className="w-full rounded-t-md" style={{ height: Math.round(((v.reps ?? 0) / mx) * 140), background: i === perVisit.length - 1 ? '#4D53E0' : '#C9CBF6' }} />
                  </div>
                ))}
              </div>
              <div className="grid gap-2.5 text-center text-[12px] text-rx-muted" style={{ gridTemplateColumns: `repeat(${perVisit.length}, minmax(0,1fr))` }}>
                {perVisit.map((v, i, arr) => <span key={v.a.appointment_id}>{label(new Date(v.a.appointment_date), i, arr)}</span>)}
              </div>
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-[2_1_280px] flex-col gap-3 rounded-lg bg-white px-[18px] py-4">
          <span className="text-[15px] font-semibold">ความเหนื่อยที่ผู้ป่วยให้ (1–5)</span>
          {fatRows.length === 0 && <span className="text-[14px] text-rx-muted">ผู้ป่วยยังไม่ได้ให้คะแนนความเหนื่อย</span>}
          {fatRows.map((v, i, arr) => (
            <div key={v.a.appointment_id} className="flex items-center gap-2.5 text-[13px]">
              <span className="w-[52px] text-rx-muted">{label(new Date(v.a.appointment_date), i, arr)}</span>
              <div className="h-2 flex-1 rounded-full bg-rx-divider"><div className="h-2 rounded-full bg-[#1F5573]" style={{ width: `${((v.fat ?? 0) / 5) * 100}%` }} /></div>
              <span className="w-5 font-semibold">{Math.round((v.fat ?? 0) * 10) / 10}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/* =========================== ประวัติการรักษา =========================== */

function HistoryTab({ data }: { data: ReturnType<typeof useCase> }) {
  const { patient, appts, sessions } = data
  if (!patient) return null
  const visits = pastVisits(appts)
  const assess = appts.filter(a => a.appointment_type === 'ASSESSMENT' && a.status === 'COMPLETED').sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))
  const came = visits.filter(v => v.status !== 'NO_SHOW').length

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <span className="text-[14px] text-rx-muted">มารับบริการ {came} ครั้ง · บันทึกผลทันทีหลังการฝึก · แก้ไขได้ด้วยการบันทึกซ้ำ</span>
        <Btn variant="outline" size="sm" onClick={() => window.print()}><Printer size={16} />ส่งออก PDF</Btn>
      </div>
      {visits.length === 0 && assess.length === 0 && <div className="rounded-lg bg-white px-5 py-6 text-[14px] text-rx-muted">ยังไม่มีประวัติการรักษา</div>}
      {visits.map(a => <VisitCard key={a.appointment_id} a={a} sessions={sessions} patient={patient} variant="therapist" amendments={data.amendments} />)}
      {assess.map(a => (
        <div key={a.appointment_id} className="flex flex-col gap-3 rounded-lg bg-white px-[18px] py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[15px] font-semibold">{thaiDate(new Date(a.appointment_date))}</span>
              <span className="text-[13px] text-rx-muted">ผู้รักษา {ptName(a.therapist_name)}</span>
              <Badge label="ประเมินแรกรับ" bg="#FFF0D9" fg="#8C420A" />
            </div>
            {a.completed_at && <Badge label={`บันทึกผลแล้ว ${hhmm(new Date(a.completed_at))}`} bg="#E4F5EC" fg="#145C38" />}
          </div>
          {patient.assessment_note && (
            <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[14px] leading-relaxed"><span className="font-semibold text-rx-muted">A</span><span>{patient.assessment_note}</span></div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-lg bg-rx-bg px-2.5 py-[3px] text-[12px]">{stageLabel(patient.start_stage ?? patient.current_stage)} (ประเมินแรกรับ)</span>
            <span className="rounded-lg bg-rx-bg px-2.5 py-[3px] text-[12px]">เปิดเคส</span>
          </div>
        </div>
      ))}
    </>
  )
}
