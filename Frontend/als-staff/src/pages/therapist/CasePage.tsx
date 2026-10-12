import { useEffect, useRef, useState } from 'react'
import { CalendarClock, Check, Lock } from 'lucide-react'
import type { AppointmentRequest, AuthUser, PatientAppointment, Program, TherapySession } from '../../types'
import { NextApptFields, bookNextAppt, emptyNextAppt, nextApptMissing, type NextAppt } from '../../components/NextAppointment'
import {
  api, list, slotLabel, apptSlot, addDays, startOfDay, sameDay, thaiDate, dayMonth, hhmm,
  isTraining, holdsSlot, queueState, BADGE, setsOfVisit, avg, stageLabel, ptName,
  effectiveSoap, SOAP_FIELDS, SOAP_LABEL,
} from '../../lib/clinic'
import { PatientHeader, VisitCard } from '../../components/VisitHistory'
import { useCase, pastVisits, activePrograms } from '../../lib/useCase'
import { BackLink, Badge, Btn, ErrorText, Field, Loading, Stat, selectCls, textareaCls } from '../../components/ui'

interface Props { user: AuthUser; patientId: string; onBack: () => void; initialTab?: 'today' | 'history' }

type Tab = 'today' | 'progress' | 'history'
// ข้างที่รักษา (ตรงกับข้างที่เป็นโรคในหน้าประเมิน) และข้างของแต่ละเซต
const SIDE_OPTIONS = ['ข้างซ้าย', 'ข้างขวา', 'ทั้งสองข้าง']
type Side = 'LEFT' | 'RIGHT'
const SIDE_LABEL: Record<Side, string> = { LEFT: 'ข้างซ้าย', RIGHT: 'ข้างขวา' }
const LIVE_POLL_MS = 3000

export default function CasePage({ user, patientId, onBack, initialTab = 'today' }: Props) {
  const data = useCase(patientId)
  const [tab, setTab] = useState<Tab>(initialTab)
  const { patient, appts, loading } = data

  if (loading) return <Loading />
  if (!patient) return <><BackLink onClick={onBack}>เคสของฉัน</BackLink><Loading text="ไม่พบข้อมูลผู้ป่วย" /></>

  const today = startOfDay(new Date())
  const todayAppt = appts
    .filter(a => isTraining(a) && holdsSlot(a) && sameDay(new Date(a.appointment_date), today))
    .sort((a, b) => ['IN_PROGRESS', 'CHECKED_IN', 'SCHEDULED', 'COMPLETED'].indexOf(a.status) - ['IN_PROGRESS', 'CHECKED_IN', 'SCHEDULED', 'COMPLETED'].indexOf(b.status))[0]
  const st = todayAppt ? queueState(todayAppt, today) : null

  const tabBtn = (k: Tab, label: string) => (
    <button key={k} type="button" onClick={() => setTab(k)} className={`flex min-h-11 items-center whitespace-nowrap px-4 text-[14px] ${tab === k ? 'border-b-2 border-rx-accent font-semibold text-rx-accent-ink' : 'text-rx-muted'}`}>{label}</button>
  )

  return (
    <>
      <BackLink onClick={onBack}>เคสของฉัน</BackLink>
      <PatientHeader
        patient={patient}
        programs={[]}
        badge={patient.case_status === 'CLOSED'
          ? <Badge label="เสร็จสิ้นการรักษา" />
          : st && st !== 'booked' ? <Badge state={st} label={`${BADGE[st][0]} · ช่อง ${slotLabel(apptSlot(todayAppt!))}`} /> : undefined}
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
  const [soap, setSoap] = useState({ s: '', o: '', a: '', p: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  // คลังโปรแกรม (โปรแกรมครั้งหน้า) และโปรแกรมครั้งหน้าที่เลือก
  const [library, setLibrary] = useState<Program[]>([])
  const [nextProg, setNextProg] = useState('')
  const [nextAppt, setNextAppt] = useState<NextAppt>(emptyNextAppt)
  // นัดที่ส่งไปแล้วและรอเวชระเบียนลงวันเวลา → ไม่ส่งซ้ำ
  const [pendingReq, setPendingReq] = useState<AppointmentRequest | null>(null)
  useEffect(() => {
    if (patient) list<AppointmentRequest>(`/api/appointment-requests?patient_id=${patient.patient_id}`).then(rs => setPendingReq(rs[0] ?? null))
  }, [patient?.patient_id, todayAppt?.soap_saved_at]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { list<Program>(`/api/programs?created_by=${user.users_id}`).then(ps => setLibrary(ps.filter(p => p.status === 'ACTIVE'))) }, [user.users_id])

  useEffect(() => {
    setSoap({ s: todayAppt?.soap_s ?? todayAppt?.symptoms_today ?? '', o: todayAppt?.soap_o ?? '', a: todayAppt?.soap_a ?? '', p: todayAppt?.soap_p ?? '' })
    setNextProg(todayAppt?.next_program_id ?? '')
  }, [todayAppt?.appointment_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // เวชระเบียนเรียกคิวแล้วกระดานเชื่อมต่อเอง → ใส่ข้างที่รักษาและโปรแกรมครั้งนี้ให้ตามค่าเริ่มต้น (นักกายภาพเปลี่ยนได้)
  // นัดที่เรียกคิวไว้ก่อนระบบเชื่อมต่อเอง (ยังค้างที่ CHECKED_IN) → เชื่อมต่อให้ตอนเปิดหน้านี้
  const autoDone = useRef<string | null>(null)
  useEffect(() => {
    if (!todayAppt || !patient || autoDone.current === `${todayAppt.appointment_id}-${todayAppt.status}`) return
    const sideDefault = patient.affected_side && SIDE_OPTIONS.includes(patient.affected_side) ? patient.affected_side : 'ข้างขวา'
    const plan = {
      treatedSide: todayAppt.treated_side ?? sideDefault,
      patientProgramId: todayAppt.patient_program_id ?? activePrograms(programs)[0]?.patient_program_id,
      currentSide: todayAppt.current_side ?? (sideDefault === 'ข้างซ้าย' ? 'LEFT' : 'RIGHT'),
    }
    const body = todayAppt.status === 'CHECKED_IN' && todayAppt.called_at
      ? { action: 'START', confirmPatientId: todayAppt.patient_id, ...plan }
      : todayAppt.status === 'IN_PROGRESS' && !todayAppt.treated_side ? { action: 'PLAN', ...plan } : null
    if (!body) return
    autoDone.current = `${todayAppt.appointment_id}-${todayAppt.status}`
    api('/api/appointments', { method: 'PATCH', body: { appointmentId: todayAppt.appointment_id, ...body } }).then(() => reload()).catch(() => {})
  }, [todayAppt?.appointment_id, todayAppt?.status, todayAppt?.called_at, todayAppt?.treated_side, programs.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ระหว่างรอเชื่อมต่อ / กำลังฝึก โหลดผลเซตและสถานะนัดถี่ ๆ (แดชบอร์ดผลการฝึกครั้งนี้อัปเดตเอง)
  const live = todayAppt?.status === 'IN_PROGRESS' || todayAppt?.status === 'CHECKED_IN'
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => { reload() }, LIVE_POLL_MS)
    return () => clearInterval(t)
  }, [todayAppt?.appointment_id, live]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!patient) return null
  const sets = todayAppt ? setsOfVisit(sessions, todayAppt) : []
  const saved = !!todayAppt?.soap_saved_at
  const current = todayAppt ? effectiveSoap(todayAppt, amendments) : null
  const myAmendments = amendments.filter(m => m.appointment_id === todayAppt?.appointment_id)

  // ข้างที่รักษาและโปรแกรมครั้งนี้ — ค่าเริ่มต้นจากข้างที่เป็นโรคและโปรแกรมที่มอบล่าสุด
  const active = activePrograms(programs)
  const side = todayAppt?.treated_side ?? (patient.affected_side && SIDE_OPTIONS.includes(patient.affected_side) ? patient.affected_side : 'ข้างขวา')
  const both = side === 'ทั้งสองข้าง'
  const thisPp = active.find(p => p.patient_program_id === todayAppt?.patient_program_id) ?? active[0]
  const nextSide = (todayAppt?.current_side as Side | null) ?? (side === 'ข้างซ้าย' ? 'LEFT' : 'RIGHT')
  const nextProgram = nextProg || thisPp?.program_id || ''
  // นัดฝึกครั้งถัดไปที่ลงไว้แล้ว (หลังจากตอนนี้ ไม่นับครั้งนี้)
  const upcoming = data.appts.filter(a => isTraining(a) && a.status === 'SCHEDULED' && a.appointment_id !== todayAppt?.appointment_id && new Date(a.appointment_date) > new Date())
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))[0]
  // แดชบอร์ดครั้งนี้เทียบครั้งก่อน
  const prevVisits = pastVisits(data.appts).filter(v => v.status === 'COMPLETED' && v.appointment_id !== todayAppt?.appointment_id).slice(0, 5)
  const visitAvg = (v: PatientAppointment) => avg(setsOfVisit(sessions, v).map(x => x.total_reps))
  const thisAvg = avg(sets.map(x => x.total_reps))
  const prevAvg = prevVisits[0] ? visitAvg(prevVisits[0]) : null

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true); setError(''); setMsg('')
    try { await fn(); await reload(); if (done) setMsg(done) } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  const patchAppt = (body: Record<string, unknown>) => api('/api/appointments', { method: 'PATCH', body: { appointmentId: todayAppt!.appointment_id, ...body } })

  return (
    <>
      <ErrorText>{error}</ErrorText>
      {msg && <div className="rounded-lg bg-[#E4F5EC] px-4 py-2.5 text-[13px] font-semibold text-[#145C38]">{msg}</div>}
      {/* บนลงล่าง: ผลการฝึกครั้งนี้ (เต็มความกว้าง) → บันทึกผลการรักษา */}
      <div className="flex flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-3.5">
          {/* แดชบอร์ดการฝึกครั้งนี้ และเทียบกับครั้งก่อน ๆ */}
          <div className="grid grid-cols-1 gap-4 rx-card px-6 py-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex min-w-0 flex-col gap-3">
            <span className="text-[15px] font-semibold">ผลการฝึกครั้งนี้</span>
            {/* ทั้งสองข้าง → กราฟคู่ซ้าย/ขวา · ข้างเดียว → กราฟเดียวของข้างนั้น */}
            {sets.length ? (
              <div className={`grid gap-3 ${both ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {(both ? (['LEFT', 'RIGHT'] as Side[]) : [nextSide]).map(sd => {
                  const items = both ? sets.filter(x => x.side === sd) : sets
                  const max = Math.max(...sets.map(x => x.total_reps), 1)
                  const total = items.reduce((n, x) => n + x.total_reps, 0)
                  return (
                    <div key={sd} className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-rx-bg px-3 py-2.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-semibold">{both ? SIDE_LABEL[sd] : side}</span>
                        <span className="text-[12px] text-rx-muted">รวม <span className="text-[15px] font-semibold text-rx-ink">{total}</span> ครั้ง · {items.length} เซต</span>
                      </div>
                      {items.length ? (
                        <div className="flex h-[96px] items-end gap-2">
                          {items.map((x, i) => (
                            <div key={x.session_id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                              <span className="text-[12px] font-semibold">{x.total_reps}</span>
                              <div className="w-full max-w-[34px] rounded-t" style={{ height: `${Math.max(6, (x.total_reps / max) * 60)}px`, background: sd === 'LEFT' && both ? '#00A5FF' : '#007AFF' }} />
                              <span className="text-[11px] text-rx-muted">เซต {i + 1}</span>
                            </div>
                          ))}
                        </div>
                      ) : <span className="py-6 text-center text-[12px] text-rx-muted">ยังไม่มีเซตของข้างนี้</span>}
                    </div>
                  )
                })}
              </div>
            ) : <span className="text-[13px] text-rx-muted">ยังไม่มีเซตที่บันทึกจากกระดานในครั้งนี้</span>}
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:border-l md:border-rx-divider md:pl-5">
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <div className="flex flex-col"><span className="text-rx-muted">เฉลี่ยครั้งนี้</span><span className="text-[16px] font-semibold">{thisAvg != null ? `${thisAvg.toFixed(1)} ครั้ง/เซต` : '–'}</span></div>
              <div className="flex flex-col">
                <span className="text-rx-muted">ครั้งก่อน</span>
                <span className="text-[16px] font-semibold">
                  {prevAvg != null ? `${prevAvg.toFixed(1)}` : '–'}
                  {prevAvg != null && thisAvg != null && <span className={`ml-1.5 text-[12px] ${thisAvg >= prevAvg ? 'text-[#2E8A0B]' : 'text-[#A32D2D]'}`}>{thisAvg >= prevAvg ? '▲' : '▼'} {Math.abs(thisAvg - prevAvg).toFixed(1)}</span>}
                </span>
              </div>
            </div>
            {prevVisits.length > 0 && (() => {
              const series = [...prevVisits].reverse().map(v => ({ k: v.appointment_id, l: dayMonth(new Date(v.appointment_date)), v: visitAvg(v) ?? 0 }))
              if (thisAvg != null) series.push({ k: 'now', l: 'วันนี้', v: thisAvg })
              const max = Math.max(...series.map(x => x.v), 1)
              return (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-rx-muted">เฉลี่ยต่อเซต {series.length} ครั้งล่าสุด</span>
                  <div className="flex h-[70px] items-end gap-1.5">
                    {series.map(x => (
                      <div key={x.k} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
                        <div className="w-full max-w-[28px] rounded-t" style={{ height: `${Math.max(4, (x.v / max) * 48)}px`, background: x.k === 'now' ? '#007AFF' : '#B3D7FF' }} />
                        <span className="truncate text-[10px] text-rx-muted">{x.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-4 rx-card px-6 py-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold">บันทึกผลการรักษา</span>
            {saved ? <Badge label={`บันทึกผลแล้ว ${hhmm(new Date(todayAppt!.soap_saved_at!))}`} bg="#E4F5EC" fg="#145C38" /> : <Badge label="ยังไม่บันทึกผล" />}
          </div>
          {!todayAppt ? <span className="text-[14px] text-rx-muted">บันทึกผลการรักษาได้ในวันที่ผู้ป่วยมาตามนัด</span> : saved && current ? (
            <>
              {SOAP_FIELDS.map(k => (
                <div key={k} className="flex flex-col gap-1">
                  <span className="text-[13px] font-semibold">{SOAP_LABEL[k]}{k === 'P' && <span className="ml-2 rounded-lg bg-rx-tint px-2 py-0.5 text-[12px] font-medium text-rx-accent-ink">ผู้ป่วยเห็นส่วนนี้</span>}</span>
                  <span className="whitespace-pre-line rounded-field bg-rx-bg px-3 py-2.5 text-[14px]">{current[k] || '–'}</span>
                </div>
              ))}
              <div className="grid grid-cols-1 gap-2 rounded-[10px] bg-rx-bg px-3 py-2.5 text-[13px] sm:grid-cols-2">
                <span><span className="text-rx-muted">ครั้งนี้ </span><span className="font-semibold">{thisPp?.program_name ?? '–'} · {side}</span></span>
                <span><span className="text-rx-muted">ครั้งหน้า </span><span className="font-semibold">{library.find(p => p.program_id === todayAppt.next_program_id)?.program_name ?? '–'}</span></span>
              </div>
              {myAmendments.map(m => (
                <div key={m.amendment_id} className="rounded-lg bg-[#FFF0D9] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#8C420A]">
                  บันทึกแก้ไขเพิ่มเติม · {ptName(m.amended_by_name)} {hhmm(new Date(m.amended_at))} — แก้ {m.field} จาก "{m.old_value || '–'}" เป็น "{m.new_value || '–'}" · เหตุผล: {m.reason} · ฉบับเดิมยังเก็บไว้
                </div>
              ))}
            </>
          ) : (
            <>
              {/* SOAP สองคอลัมน์ */}
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <Field label={SOAP_LABEL.S} htmlFor="s"><textarea id="s" rows={3} className={textareaCls} value={soap.s} onChange={e => setSoap(x => ({ ...x, s: e.target.value }))} /></Field>
              <Field label={SOAP_LABEL.O} hint="อ่านผลแต่ละเซตจากการ์ดผลการฝึกครั้งนี้" htmlFor="o">
                <textarea id="o" rows={3} className={textareaCls} value={soap.o} onChange={e => setSoap(x => ({ ...x, o: e.target.value }))} />
              </Field>
              <Field label={SOAP_LABEL.A} htmlFor="a"><textarea id="a" rows={3} className={textareaCls} placeholder="สรุปการประเมินจากข้อมูลด้านบน · อาการคงที่ถือเป็นผลที่ดี" value={soap.a} onChange={e => setSoap(x => ({ ...x, a: e.target.value }))} /></Field>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="p" className="text-[13px] font-semibold">{SOAP_LABEL.P}</label>
                  <span className="rounded-lg bg-rx-tint px-2 py-0.5 text-[12px] font-medium text-rx-accent-ink">ผู้ป่วยจะเห็นส่วนนี้</span>
                </div>
                <textarea id="p" rows={3} className={textareaCls} placeholder="คำแนะนำที่จะไปขึ้นหน้าคำแนะนำของผู้ป่วย" value={soap.p} onChange={e => setSoap(x => ({ ...x, p: e.target.value }))} />
              </div>
              </div>
            </>
          )}
        </div>
        {/* กล่องแยก: โปรแกรม · การนัดครั้งถัดไป · ปุ่มบันทึก (เฉพาะตอนยังไม่บันทึกผล) */}
        {todayAppt && !(saved && current) && (
          <div className="flex min-w-0 flex-col gap-4 rx-card px-6 py-5">
            {/* โปรแกรม (บน · สองช่องคู่กัน) → การนัดครั้งถัดไป (ล่าง) */}
            <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">โปรแกรมครั้งนี้</span>
                <span className="flex h-11 items-center rounded-field bg-rx-bg px-3 text-[14px]">{thisPp?.program_name ?? '–'} · {side}</span>
              </div>
              <Field label="โปรแกรมครั้งหน้า" htmlFor="nxp">
                <select id="nxp" className={selectCls} value={nextProgram} onChange={e => setNextProg(e.target.value)}>
                  <option value="">ยังไม่ระบุ</option>
                  {library.map(p => <option key={p.program_id} value={p.program_id}>{p.program_name} · {stageLabel(p.target_stage)}</option>)}
                </select>
              </Field>
            </div>
            {/* การนัดครั้งถัดไป — บันทึกพร้อมผลการรักษาด้วยปุ่มเดียว */}
            <div className="flex flex-col gap-2.5 border-t border-rx-divider pt-4">
              <span className="text-[15px] font-semibold">การนัดครั้งถัดไป</span>
              {upcoming
                ? <span className="rounded-lg bg-[#EAF7E3] px-3.5 py-2.5 text-[14px] font-semibold text-[#145C38]">มีนัดแล้ว: {thaiDate(new Date(upcoming.appointment_date))} · {slotLabel(apptSlot(upcoming))} น.</span>
                : pendingReq
                ? <span className="rounded-lg bg-[#FFF0D9] px-3.5 py-2.5 text-[14px] font-semibold text-[#8C420A]">ส่งนัดแล้ว · รอเวชระเบียนลงวันและเวลา{pendingReq.note ? ` · ${pendingReq.note}` : ''}</span>
                : <NextApptFields value={nextAppt} onChange={setNextAppt} id="nat" />}
            </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-rx-divider pt-4">
              <span className="flex-[1_1_220px] text-[12px] text-rx-muted">บันทึกผลเมื่อผู้ป่วยฝึกครบ · การบันทึกผลคือการจบการฝึกและปล่อยกระดาน · บันทึกแล้วแก้ได้ด้วยบันทึกแก้ไขเพิ่มเติมเท่านั้น</span>
              {!upcoming && nextApptMissing(nextAppt)
                ? <Btn disabled>{nextApptMissing(nextAppt)}</Btn>
                : <Btn disabled={busy || !['IN_PROGRESS', 'COMPLETED'].includes(todayAppt.status)} onClick={() => run(async () => {
                    // ลงนัดก่อน (ถ้าช่องไม่ว่างจะหยุดตรงนี้ ผลการรักษายังไม่ถูกบันทึก) แล้วค่อยบันทึกผลและจบการฝึก
                    if (!upcoming && !pendingReq && nextAppt.want) await bookNextAppt(nextAppt, patient.patient_id)
                    await patchAppt({ soapS: soap.s, soapO: soap.o, soapA: soap.a, soapP: soap.p, nextProgramId: nextProgram || null, saveSoap: true })
                    setNextAppt(emptyNextAppt())
                  }, todayAppt.status === 'IN_PROGRESS' ? 'บันทึกผลและลงนัดแล้ว · จบการฝึกและปล่อยกระดานแล้ว เวชระเบียนเรียกคิวถัดไปได้' : 'บันทึกผลการรักษาแล้ว')}>{todayAppt.status === 'IN_PROGRESS' ? 'บันทึกผลและจบการฝึก' : 'บันทึกผลการรักษา'}</Btn>}
            </div>
          </div>
        )}
        </div>
      </div>
      <AfterCard data={data} hidden={!!todayAppt && !saved} />
    </>
  )
}

/**
 * การนัดครั้งถัดไปนอกการบันทึกผล: นัดที่เวชระเบียนลงแล้ว / ส่งนัดแล้วรอเวชระเบียนลงวันเวลา / ส่งนัดเพิ่ม / เคสที่ปิดแล้ว
 * ระหว่างที่ยังไม่บันทึกผลครั้งนี้ ช่องนัดอยู่ในการ์ดบันทึกผลแล้ว จึงไม่แสดงการ์ดนี้ (hidden)
 */
function AfterCard({ data, hidden }: { data: ReturnType<typeof useCase>; hidden: boolean }) {
  const { patient, appts, reload } = data
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [next, setNext] = useState<NextAppt>(emptyNextAppt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadRequests = () => patient && list<AppointmentRequest>(`/api/appointment-requests?patient_id=${patient.patient_id}`).then(setRequests)
  useEffect(() => { loadRequests() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!patient) return null
  const closed = patient.case_status === 'CLOSED'
  if (hidden && !closed) return null
  const upcoming = appts.filter(a => isTraining(a) && a.status === 'SCHEDULED' && new Date(a.appointment_date) > new Date()).sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))[0]
  // ส่งนัดแล้ว รอเวชระเบียนลงวันและเวลา
  const pending = requests[0]

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await fn(); await Promise.all([reload(), loadRequests()]) } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  const ud = upcoming ? new Date(upcoming.appointment_date) : null

  return (
    <div className="flex flex-col gap-3.5 rx-card px-6 py-5">
      <span className="text-[20px] font-semibold">การนัดครั้งถัดไป</span>
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
      ) : upcoming && ud ? (
        <div className="flex flex-wrap items-center gap-3.5 rounded-lg bg-[#EAF7E3] px-[18px] py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#43BC13] text-white"><Check size={20} /></div>
          <div className="flex flex-[1_1_260px] flex-col">
            <span className="text-[16px] font-semibold text-[#145C38]">นัดครั้งถัดไป: {thaiDate(ud)} · {slotLabel(apptSlot(upcoming))} น. · {ptName(upcoming.therapist_name)}</span>
            <span className="text-[13px] text-[#2E6B1A]">{upcoming.note ? `หมายเหตุ: ${upcoming.note} · ` : ''}เวชระเบียนลงนัดแล้ว · ขึ้นในคิวและแอปผู้ป่วยแล้ว</span>
          </div>
          <Btn variant="outline" size="sm" disabled={busy} onClick={() => run(() => api('/api/appointments', { method: 'PATCH', body: { appointmentId: upcoming.appointment_id, action: 'CANCEL' } }))}>ยกเลิกนัดนี้</Btn>
        </div>
      ) : (
        <>
          {pending && (
            <div className="flex flex-wrap items-center gap-3.5 rounded-lg bg-[#FFF0D9] px-[18px] py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E08A1E] text-white"><CalendarClock size={20} /></div>
              <div className="flex flex-[1_1_260px] flex-col">
                <span className="text-[16px] font-semibold text-[#8C420A]">ส่งนัดแล้ว · รอเวชระเบียนลงวันและเวลา</span>
                <span className="text-[14px] text-[#8C420A]">{pending.note ? `หมายเหตุ: ${pending.note}` : 'ไม่มีหมายเหตุ'}</span>
              </div>
              <Btn variant="outline" size="sm" disabled={busy} onClick={() => run(() => api('/api/appointment-requests', { method: 'PATCH', body: { requestId: pending.request_id, action: 'CANCEL' } }))}>ยกเลิกนัด</Btn>
            </div>
          )}
          {!pending && <NextApptFields value={next} onChange={setNext} id="nac" />}
          {!pending && next.want && (
            <div className="flex justify-end">
              {nextApptMissing(next)
                ? <Btn disabled>{nextApptMissing(next)}</Btn>
                : <Btn disabled={busy} onClick={() => run(async () => { await bookNextAppt(next, patient.patient_id); setNext(emptyNextAppt()) })}>ส่งนัด</Btn>}
            </div>
          )}
        </>
      )}
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

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
        <Stat label="ครั้งเฉลี่ยต่อเซต (4 สัปดาห์)" value={avgReps != null ? avgReps.toFixed(1) : '–'} />
        <Stat label="เวลาเฉลี่ยต่อครั้ง" value={secPerRep != null ? `${secPerRep} วิ` : '–'} />
        <Stat label="ความเหนื่อยเฉลี่ย" value={fat != null ? `${fat.toFixed(1)} / 5` : '–'} />
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[3_1_420px] flex-col gap-3 rx-card px-[18px] py-4">
          <div className="flex items-center justify-between gap-2"><span className="text-[15px] font-semibold">จำนวนครั้ง</span><span className="text-[12px] text-rx-muted">ครั้งต่อเซต · ต่อการมาแต่ละครั้ง</span></div>
          {perVisit.length === 0 ? <span className="text-[14px] text-rx-muted">ยังไม่มีผลการฝึก</span> : (
            <>
              <div className="grid h-[170px] items-end gap-2.5 border-b border-rx-soft" style={{ gridTemplateColumns: `repeat(${perVisit.length}, minmax(0,1fr))` }}>
                {perVisit.map((v, i) => (
                  <div key={v.a.appointment_id} className="flex flex-col items-center gap-1">
                    <span className="text-[12px] text-rx-muted">{v.reps != null ? Math.round(v.reps * 10) / 10 : ''}</span>
                    <div className="w-full rounded-t-md" style={{ height: Math.round(((v.reps ?? 0) / mx) * 140), background: i === perVisit.length - 1 ? '#007AFF' : '#B3D7FF' }} />
                  </div>
                ))}
              </div>
              <div className="grid gap-2.5 text-center text-[12px] text-rx-muted" style={{ gridTemplateColumns: `repeat(${perVisit.length}, minmax(0,1fr))` }}>
                {perVisit.map((v, i, arr) => <span key={v.a.appointment_id}>{label(new Date(v.a.appointment_date), i, arr)}</span>)}
              </div>
            </>
          )}
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

  return (
    <>
      {visits.length === 0 && assess.length === 0 && <div className="rx-card px-5 py-6 text-[14px] text-rx-muted">ยังไม่มีประวัติการรักษา</div>}
      {visits.map(a => <VisitCard key={a.appointment_id} a={a} sessions={sessions} patient={patient} variant="therapist" amendments={data.amendments} />)}
      {assess.map(a => (
        <div key={a.appointment_id} className="flex flex-col gap-3 rx-card px-[18px] py-4">
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
