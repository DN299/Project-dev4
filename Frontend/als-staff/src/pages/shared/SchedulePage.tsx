import { useEffect, useState } from 'react'
import { ChevronLeft, Plus } from 'lucide-react'
import type { AppointmentRequest, AuthUser, Patient, PatientAppointment, Therapist } from '../../types'
import {
  api, list, rangeQuery, SLOTS, LUNCH_BEFORE, slotDate, slotLabel, isoDate, apptSlot, addDays, startOfDay, sameDay, mondayOf,
  thaiDate, dayMonth, isTraining, holdsSlot, trainingAt, queueState, BADGE, DOWS, MON, MONTH,
  ptName, fullName,
} from '../../lib/clinic'
import { Badge, Btn, ErrorText, IconBtn, Loading, inputCls, selectCls } from '../../components/ui'

interface Props {
  user: AuthUser
  /** คำขอนัดที่กดมาจากหน้าสถานะ → เปิดโหมดลงนัดให้ผู้ป่วยคนนั้นทันที */
  bookRequestId?: string | null
  onBookingHandled?: () => void
}

const DAY_HEAD = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']

export default function SchedulePage({ user, bookRequestId, onBookingHandled }: Props) {
  const isPt = user.role_id === 'R002'
  const me = user.ot_id ?? ''
  const today = startOfDay(new Date())

  const [view, setView] = useState<'month' | 'week'>('month')
  const [mo, setMo] = useState(0)
  const [wk, setWk] = useState(0)
  const [sel, setSel] = useState(today)
  const [dayOpen, setDayOpen] = useState(false)
  // เวชระเบียน: 'all' หรือ ot_id · นักกายภาพ: 'mine' หรือ 'all'
  const [ptf, setPtf] = useState(isPt ? 'mine' : 'all')
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // โหมดลงนัดตามคำขอของนักกายภาพ (เวชระเบียน)
  const [bookFor, setBookFor] = useState<AppointmentRequest | null>(null)
  // เพิ่มนัดในช่องว่างของวันที่เปิดดู (เวชระเบียน) — เลือกผู้ป่วย นักกายภาพคือเจ้าของเคสของผู้ป่วยคนนั้น
  const [adding, setAdding] = useState<{ s: string; patientId: string; note: string } | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [saving, setSaving] = useState(false)

  const first = new Date(today.getFullYear(), today.getMonth() + mo, 1)
  const gridStart = mondayOf(first)
  const monday = addDays(mondayOf(today), wk * 7)
  const fetchFrom = [gridStart, monday, sel].reduce((a, b) => (a < b ? a : b))
  const fetchTo = [addDays(gridStart, 42), addDays(monday, 7), addDays(sel, 1)].reduce((a, b) => (a > b ? a : b))

  const load = () => list<PatientAppointment>(`/api/appointments?${rangeQuery(fetchFrom, fetchTo)}`).then(setAppts).finally(() => setLoading(false))
  useEffect(() => { load() }, [fetchFrom.getTime(), fetchTo.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    list<Therapist>('/api/therapists').then(setTherapists)
    if (!isPt) list<Patient>('/api/patients?status=ALL').then(setPatients)
  }, [isPt, me])

  const mineOt = isPt ? (ptf === 'mine' ? me : null) : (ptf === 'all' ? null : ptf)
  const training = appts.filter(a => isTraining(a) && holdsSlot(a))
  const onDay = (d: Date, ot: string | null = mineOt) => training.filter(a => sameDay(new Date(a.appointment_date), d) && (!ot || a.ot_id === ot))
  const count = (d: Date, ot: string | null = mineOt, sts?: string[]) => onDay(d, ot).filter(a => !sts || sts.includes(queueState(a, today))).length

  // ลงนัดตามคำขอ: ปฏิทินแสดงวันที่นักกายภาพคนนั้นว่าง ให้เวชระเบียนเลือกวันเอง
  const inWindow = (d: Date) => !!bookFor && isoDate(d) >= bookFor.earliest_date && isoDate(d) <= bookFor.latest_date
  const freeFor = (d: Date, s: string) => {
    if (!bookFor || !inWindow(d) || slotDate(d, s) <= new Date()) return false
    if (trainingAt(training, d, s)) return false
    const held = appts.filter(a => holdsSlot(a) && sameDay(new Date(a.appointment_date), d))
    if (held.some(a => a.patient_id === bookFor.patient_id)) return false
    return !held.some(a => a.ot_id === bookFor.ot_id && apptSlot(a) === s)
  }
  const freeCount = (d: Date) => SLOTS.filter(x => freeFor(d, x.s)).length
  const startBooking = (r: AppointmentRequest) => { setBookFor(r); setPtf(r.ot_id ?? 'all'); setDayOpen(false); setView('month'); setMo(0); setError('') }
  useEffect(() => {
    if (!bookRequestId || isPt) return
    list<AppointmentRequest>('/api/appointment-requests?status=PENDING').then(rs => {
      const r = rs.find(x => x.request_id === bookRequestId)
      if (r) startBooking(r)
      onBookingHandled?.()
    })
  }, [bookRequestId]) // eslint-disable-line react-hooks/exhaustive-deps
  const stopBooking = () => { setBookFor(null); setPtf('all'); setError('') }
  const bookAt = async (s: string) => {
    if (!bookFor) return
    setSaving(true); setError('')
    try {
      await api('/api/appointment-requests', { method: 'PATCH', body: { requestId: bookFor.request_id, action: 'BOOK', appointmentDate: slotDate(sel, s).toISOString() } })
      setBookFor(null); setPtf('all'); setDayOpen(false); await load()
    } catch (e) { setError((e as Error).message) }
    setSaving(false)
  }

  // ผู้ป่วยที่ลงนัดได้: เคสกำลังรักษา มีเจ้าของเคส · ถ้าเลือกดูตารางของนักกายภาพคนไหน แสดงเฉพาะเคสของคนนั้น
  const bookable = patients.filter(p => p.case_status === 'ACTIVE' && p.primary_ot_id && (!mineOt || p.primary_ot_id === mineOt))
  const owners = therapists.filter(t => bookable.some(p => p.primary_ot_id === t.ot_id))
  const addProblem = (s: string, patientId: string) => {
    const p = patients.find(x => x.patient_id === patientId)
    if (!p) return 'เลือกผู้ป่วย'
    const held = appts.filter(a => holdsSlot(a) && sameDay(new Date(a.appointment_date), sel))
    if (held.some(a => a.patient_id === p.patient_id)) return 'ผู้ป่วยมีนัดในวันนี้แล้ว'
    if (held.some(a => a.ot_id === p.primary_ot_id && apptSlot(a) === s)) return 'เจ้าของเคสติดนัดช่องนี้'
    return ''
  }
  const addAppt = async () => {
    if (!adding) return
    const p = patients.find(x => x.patient_id === adding.patientId)
    if (!p?.primary_ot_id) return
    setSaving(true); setError('')
    try {
      await api('/api/appointments', { method: 'POST', body: { patientId: p.patient_id, otId: p.primary_ot_id, appointmentDate: slotDate(sel, adding.s).toISOString(), note: adding.note.trim() || null } })
      setAdding(null); await load()
    } catch (e) { setError((e as Error).message) }
    setSaving(false)
  }

  if (loading) return <Loading />

  const bookingBar = bookFor && (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border-[1.5px] border-rx-accent bg-rx-tint px-5 py-3.5">
      <div className="flex flex-[1_1_320px] flex-col gap-0.5">
        <span className="text-[15px] font-semibold">กำลังลงนัดให้ {fullName(bookFor.patient_name, bookFor.patient_lastname)} · {ptName(bookFor.therapist_name)}</span>
        <span className="text-[13px] text-rx-accent-deep">“{bookFor.note || bookFor.window_label}” · ปฏิทินแสดงช่องที่ {ptName(bookFor.therapist_name)} ว่าง · เลือกวัน แล้วกดลงนัดที่ช่องเวลา</span>
      </div>
      <Btn variant="outline" size="sm" onClick={stopBooking}>ยกเลิกการลงนัด</Btn>
    </div>
  )

  const filterSelect = (id: string) => (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="whitespace-nowrap text-[13px] text-rx-muted">{isPt ? 'แสดง' : 'ดูตารางนัดของ'}</label>
      <select id={id} value={ptf} onChange={e => setPtf(e.target.value)} className={`${selectCls} h-10 min-w-[200px] font-semibold`}>
        {isPt ? (
          <><option value="mine">นัดของฉัน ({ptName(user.first_name)})</option><option value="all">ทุกนักกายภาพ</option></>
        ) : (
          <><option value="all">นักกายภาพทุกคน</option>{therapists.map(t => <option key={t.ot_id} value={t.ot_id}>{ptName(t.first_name)}</option>)}</>
        )}
      </select>
    </div>
  )
  const tgl = (on: boolean) => `h-10 px-4 text-[13px] font-semibold ${on ? 'bg-rx-accent text-white' : 'bg-white text-rx-ink'}`
  const openDay = (d: Date) => { setSel(d); setDayOpen(true); setError('') }

  /* ---------- รายละเอียดวัน ---------- */
  if (dayOpen) {
    const past = sel < today
    const nAll = count(sel, null)
    const nMine = count(sel, me)
    const stats: [string, string, string][] = isPt
      ? [['นัดของฉัน', `${nMine} นัด`, '#16365F'], ['คิวที่ว่าง', `${SLOTS.length - nAll} ช่อง`, '#2E8A0B'], ['นัดทั้งศูนย์', `${nAll}/${SLOTS.length}`, '#007AFF']]
      : [
          ['นัดทั้งหมด', `${count(sel)} นัด`, '#16365F'],
          [sel > today ? 'ยืนยันนัดแล้ว' : 'มารักษาแล้ว', `${count(sel, mineOt, sel > today ? ['booked'] : ['done', 'review'])} คน`, '#2E8A0B'],
          mineOt
            ? [past ? 'ไม่มาตามนัด' : 'รอ / ยังไม่มา', `${count(sel, mineOt, past ? ['noshow'] : ['wait', 'notyet', 'now'])} คน`, '#007AFF']
            : ['ช่องว่าง', `${SLOTS.length - nAll} ช่อง`, '#007AFF'],
        ]

    return (
      <>
        <h1 className="m-0 text-[28px] font-bold leading-tight">ตารางนัด</h1>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <button type="button" onClick={() => setDayOpen(false)} className="flex h-10 items-center gap-1.5 rounded-full rx-glass-control px-3.5 text-[13px] font-semibold"><ChevronLeft size={16} />กลับไปปฏิทิน</button>
          <div className="flex items-center gap-2">
            <IconBtn label="วันก่อนหน้า" dir="prev" onClick={() => openDay(addDays(sel, -1))} />
            <span className="text-[14px] font-semibold text-rx-muted">เลื่อนวัน</span>
            <IconBtn label="วันถัดไป" dir="next" onClick={() => openDay(addDays(sel, 1))} />
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[24px] font-semibold">นัดของ{thaiDate(sel)}</span>
            <span className="text-[14px] text-rx-muted">
              {sameDay(sel, today) ? 'วันนี้' : past ? 'ย้อนหลัง' : 'ล่วงหน้า'}
              {!isPt && ` · ${mineOt ? `ตารางนัดของ ${ptName(therapists.find(t => t.ot_id === mineOt)?.first_name)}` : `ทุกนักกายภาพ · จองแล้ว ${nAll} จาก ${SLOTS.length} ช่อง`}`}
            </span>
          </div>
          {filterSelect('ptsel2')}
        </div>
        {bookingBar}
        <ErrorText>{error}</ErrorText>
          <div className="flex flex-col gap-[18px]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              {stats.map(([l, v, c]) => (
                <div key={l} className="flex flex-col gap-1 rx-card px-6 py-5">
                  <span className="text-[14px] text-rx-muted">{l}</span>
                  <span className="text-[30px] font-semibold" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rx-card">
              <div className="min-w-[760px]">
                <div className="grid items-center gap-2.5 px-5 py-3.5 text-[12px] text-rx-muted" style={{ gridTemplateColumns: isPt ? '130px minmax(0,1.6fr) minmax(0,1fr) 130px' : '130px minmax(0,1.6fr) 110px minmax(0,1fr) 130px 120px' }}>
                  {(isPt ? ['ช่วงเวลา', 'ผู้ป่วย', 'นักกายภาพ', 'สถานะ'] : ['ช่วงเวลา', 'ผู้ป่วย', 'HN', 'นักกายภาพ', 'สถานะ', '']).map((h, i) => <span key={i}>{h}</span>)}
                </div>
                {SLOTS.map((x, i) => {
                  const a = trainingAt(training, sel, x.s)
                  // โหมดลงนัด: แสดงทุกช่องให้เห็นช่องว่าง
                  const hidden = !bookFor && mineOt && !!a && a.ot_id !== mineOt
                  const canBook = freeFor(sel, x.s)
                  const st = a ? queueState(a, today) : null
                  const cols = isPt ? '130px minmax(0,1.6fr) minmax(0,1fr) 130px' : '130px minmax(0,1.6fr) 110px minmax(0,1fr) 130px 120px'
                  return (
                    <div key={x.s}>
                      {i === LUNCH_BEFORE && !mineOt && (
                        <div className="grid items-center gap-2.5 bg-rx-bg px-5 py-3.5 text-[14px] text-rx-muted" style={{ gridTemplateColumns: cols }}><span>12:00 – 13:00</span><span>พักกลางวัน</span></div>
                      )}
                      {!hidden && (
                        <div className={`grid items-center gap-2.5 border-t border-rx-divider px-5 py-3.5 text-[14px] `} style={{ gridTemplateColumns: cols }}>
                          <span className="font-semibold">{slotLabel(x.s)}</span>
                          <span className={a ? 'font-semibold' : 'text-rx-muted'}>{a ? fullName(a.patient_name, a.patient_lastname) : 'ว่าง'}</span>
                          {!isPt && <span className="text-rx-muted">{a?.patient_id ?? ''}</span>}
                          <span>{a ? ptName(a.therapist_name) : '–'}</span>
                          <div>{st && <Badge state={st} />}</div>
                          {!isPt && (
                            <div>
                              {bookFor
                                ? canBook && <Btn size="sm" disabled={saving} onClick={() => bookAt(x.s)}>ลงนัดที่นี่</Btn>
                                : !a && slotDate(sel, x.s) > new Date() && adding?.s !== x.s && (
                                  <Btn size="sm" variant="outline" onClick={() => { setAdding({ s: x.s, patientId: '', note: '' }); setError('') }}><Plus size={15} />เพิ่มนัด</Btn>
                                )}
                            </div>
                          )}
                        </div>
                      )}
                      {adding?.s === x.s && (() => {
                        const problem = adding.patientId ? addProblem(x.s, adding.patientId) : ''
                        const owner = therapists.find(t => t.ot_id === patients.find(p => p.patient_id === adding.patientId)?.primary_ot_id)
                        return (
                          <div className="flex flex-wrap items-end gap-3 border-t border-rx-divider bg-rx-tint px-5 py-3.5">
                            <label className="flex min-w-[260px] flex-[2_1_260px] flex-col gap-1 text-[13px] font-semibold">
                              ผู้ป่วย (แยกตามเจ้าของเคส)
                              <select className={selectCls} value={adding.patientId} onChange={e => setAdding({ ...adding, patientId: e.target.value })}>
                                <option value="">เลือกผู้ป่วย</option>
                                {owners.map(t => (
                                  <optgroup key={t.ot_id} label={`เคสของ ${ptName(t.first_name)}`}>
                                    {bookable.filter(p => p.primary_ot_id === t.ot_id).map(p => <option key={p.patient_id} value={p.patient_id}>{fullName(p.first_name, p.last_name)} · HN {p.patient_id}</option>)}
                                  </optgroup>
                                ))}
                              </select>
                            </label>
                            <label className="flex min-w-[200px] flex-[1_1_200px] flex-col gap-1 text-[13px] font-semibold">
                              หมายเหตุ
                              <input className={inputCls} value={adding.note} placeholder="ไม่บังคับ" onChange={e => setAdding({ ...adding, note: e.target.value })} />
                            </label>
                            <div className="flex gap-2">
                              <Btn variant="outline" onClick={() => setAdding(null)}>ยกเลิก</Btn>
                              <Btn disabled={!adding.patientId || !!problem || saving} onClick={addAppt}>{saving ? 'กำลังบันทึก...' : problem || `ลงนัด ${x.s} น.`}</Btn>
                            </div>
                            {owner && !problem && <span className="w-full text-[12px] text-rx-muted">นัดกับเจ้าของเคส {ptName(owner.first_name)}</span>}
                            {bookable.length === 0 && <span className="w-full text-[12px] text-rx-muted">ไม่มีผู้ป่วยที่กำลังรักษา{mineOt ? 'ในเคสของนักกายภาพคนนี้' : ''}</span>}
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
                {!bookFor && mineOt && !isPt && onDay(sel).length === 0 && <div className="p-5 text-[14px] text-rx-muted">ไม่มีนัดของนักกายภาพคนนี้ในวันนี้</div>}
              </div>
            </div>
          </div>
      </>
    )
  }

  /* ---------- ปฏิทิน ---------- */
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) { const d = addDays(gridStart, i); if (i >= 35 && d.getMonth() !== first.getMonth()) break; cells.push(d) }
  const monthMeta = (d: Date): { meta: string; meta2: string; bg: string; c: string; c2?: string } => {
    const all = count(d, null)
    // โหมดลงนัด: บอกจำนวนช่องที่นักกายภาพคนนั้นว่างในแต่ละวัน
    if (bookFor) {
      const n = count(d)
      if (!inWindow(d)) return { meta: n ? `นัด ${n}` : '–', meta2: '', bg: '#F7F8FB', c: '#9AA7B5' }
      const f = freeCount(d)
      return { meta: f ? `ว่าง ${f} ช่อง` : 'ไม่ว่าง', meta2: n ? `นัดอยู่ ${n}` : '', bg: f ? '#E4F5EC' : '#FCEBEB', c: f ? '#145C38' : '#791F1F', c2: '#5B738B' }
    }
    if (isPt) {
      const my = count(d, me), free = SLOTS.length - all
      return {
        meta: my ? `มีนัด ${my} นัด` : 'ไม่มีนัด', bg: my ? '#007AFF' : '#F7F8FB', c: my ? '#FFFFFF' : '#5B738B',
        meta2: d < today ? '' : ptf === 'mine' ? (free ? `คิวที่ว่าง ${free}` : 'คิวเต็ม') : `ทั้งศูนย์ ${all}/${SLOTS.length}`,
        c2: free ? '#2E8A0B' : '#791F1F',
      }
    }
    if (mineOt) { const n = count(d); return { meta: n ? `นัด ${n}` : 'ไม่มีนัด', meta2: '', bg: n ? '#E5F1FF' : '#F7F8FB', c: n ? '#0066D6' : '#5B738B' } }
    return {
      meta: all >= SLOTS.length ? 'เต็ม' : d < today ? `มา ${count(d, null, ['done', 'review'])}` : `จอง ${all}/${SLOTS.length}`, meta2: '',
      bg: all >= SLOTS.length ? '#FCEBEB' : all >= SLOTS.length - 1 ? '#FFF0D9' : '#E4F5EC', c: all >= SLOTS.length ? '#791F1F' : all >= SLOTS.length - 1 ? '#8C420A' : '#145C38',
    }
  }
  const sunday = addDays(monday, 6)

  return (
    <>
      <div className="flex flex-col">
        <h1 className="m-0 text-[28px] font-bold leading-tight">ตารางนัด</h1>
        {isPt && <span className="text-[13px] text-rx-muted">ดูเป็นรายเดือนหรือรายสัปดาห์ · ส่งคำขอนัดจากหน้าเคส เวชระเบียนเป็นผู้ลงนัด</span>}
      </div>
      {/* เวชระเบียนลงนัดตามข้อความของนักกายภาพ: กดลงนัด แล้วเลือกวันจากปฏิทิน */}
      {bookingBar}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <IconBtn label="ก่อนหน้า" dir="prev" onClick={() => (view === 'month' ? setMo(mo - 1) : setWk(wk - 1))} />
            <span className="min-w-[200px] text-center text-[18px] font-semibold">
              {view === 'month' ? `${MONTH[first.getMonth()]} ${first.getFullYear() + 543}` : `${dayMonth(monday)} – ${dayMonth(sunday)} ${sunday.getFullYear() + 543}`}
            </span>
            <IconBtn label="ถัดไป" dir="next" onClick={() => (view === 'month' ? setMo(mo + 1) : setWk(wk + 1))} />
            <button type="button" onClick={() => { setMo(0); setWk(0); setSel(today) }} className="h-10 whitespace-nowrap rounded-full rx-glass-control px-3.5 text-[13px] font-semibold">วันนี้</button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex overflow-hidden rounded-lg border border-rx-line bg-white">
              <button type="button" onClick={() => setView('month')} className={tgl(view === 'month')}>เดือน</button>
              <button type="button" onClick={() => setView('week')} className={tgl(view === 'week')}>สัปดาห์</button>
            </div>
          </div>
        </div>
        {!isPt && <div className="flex flex-wrap items-center justify-between gap-2.5">{filterSelect('ptsel1')}</div>}

        {view === 'month' ? (
          <div className="flex min-w-0 flex-col gap-3 rx-card p-3.5">
            <div className="grid grid-cols-7 gap-1.5 text-center text-[12px] text-rx-muted">{DAY_HEAD.map(d => <span key={d}>{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map(d => {
                const inM = d.getMonth() === first.getMonth()
                const isT = sameDay(d, today)
                const m = monthMeta(d)
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    onClick={() => openDay(d)}
                    disabled={!!bookFor && !inWindow(d)}
                    className={`flex min-h-[78px] disabled:cursor-not-allowed disabled:opacity-60 flex-col items-start justify-between gap-1 rounded-lg p-2 text-left ${inM ? 'text-rx-ink' : 'text-rx-faint'} ${isT ? 'border-2 border-rx-accent bg-white' : `border border-rx-soft ${inM ? 'bg-white' : 'bg-rx-bg'}`}`}
                  >
                    <span className="text-[14px] font-semibold">{d.getDate()}</span>
                    {inM && <span className={`rounded-md px-1.5 py-0.5 font-semibold ${isPt ? 'text-[13px]' : 'text-[11px]'}`} style={{ background: m.bg, color: m.c }}>{m.meta}</span>}
                    {inM && m.meta2 && <span className="text-[11px]" style={{ color: m.c2 }}>{m.meta2}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rx-card p-3">
            <div className="grid min-w-[840px] grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map(d => {
                const items = onDay(d).sort((a, b) => a.appointment_date.localeCompare(b.appointment_date))
                return (
                  <div key={d.toISOString()} className="flex min-w-0 flex-col gap-1">
                    <button type="button" onClick={() => openDay(d)} className={`flex min-h-[52px] flex-col items-center justify-center rounded-lg ${sameDay(d, today) ? 'border-2 border-rx-accent' : 'border border-rx-soft'} bg-white`}>
                      <span className="text-[12px]">{DOWS[d.getDay()]}{sameDay(d, today) ? ' · วันนี้' : ''}</span>
                      <span className="text-[15px] font-semibold">{d.getDate()} {MON[d.getMonth()]}</span>
                    </button>
                    {items.map(a => {
                      const st = queueState(a, today)
                      return (
                        <div key={a.appointment_id} className="truncate rounded-md px-1.5 py-1 text-[11px] leading-snug" style={{ background: BADGE[st][1], color: BADGE[st][2] }}>
                          <span className="font-semibold">{apptSlot(a)}</span> {fullName(a.patient_name, a.patient_lastname)}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <span className="text-[13px] text-rx-muted">{isPt ? 'กดที่วันเพื่อเปิดรายละเอียดและลงนัดในช่องที่ว่าง' : 'กดที่วันในปฏิทินเพื่อเปิดรายละเอียดนัดของวันนั้นทั้งหน้า'}</span>
      </div>
    </>
  )
}
