import { useEffect, useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import type { AuthUser, Patient, PatientAppointment, Therapist } from '../../types'
import {
  api, list, rangeQuery, SLOTS, SLOT_MIN, LUNCH_BEFORE, slotDate, slotLabel, apptSlot, addDays, startOfDay, sameDay, mondayOf,
  thaiDate, dayMonth, hhmm, isClosedDay, isTraining, holdsSlot, trainingAt, queueState, BADGE, DOWS, MON, MONTH,
  ptName, fullName,
} from '../../lib/clinic'
import { Badge, Btn, ErrorText, IconBtn, Loading, Notice, selectCls } from '../../components/ui'

interface Props { user: AuthUser }

const DAY_HEAD = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์']

export default function SchedulePage({ user }: Props) {
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
  const [myCases, setMyCases] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [bk, setBk] = useState<string | null>(null)
  const [bkPatient, setBkPatient] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const first = new Date(today.getFullYear(), today.getMonth() + mo, 1)
  const gridStart = mondayOf(first)
  const monday = addDays(mondayOf(today), wk * 7)
  const fetchFrom = [gridStart, monday, sel].reduce((a, b) => (a < b ? a : b))
  const fetchTo = [addDays(gridStart, 42), addDays(monday, 7), addDays(sel, 1)].reduce((a, b) => (a > b ? a : b))

  const load = () => list<PatientAppointment>(`/api/appointments?${rangeQuery(fetchFrom, fetchTo)}`).then(setAppts).finally(() => setLoading(false))
  useEffect(() => { load() }, [fetchFrom.getTime(), fetchTo.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    list<Therapist>('/api/therapists').then(setTherapists)
    if (isPt) list<Patient>('/api/patients?status=ALL').then(ps => setMyCases(ps.filter(p => p.primary_ot_id === me && p.case_status === 'ACTIVE')))
  }, [isPt, me])

  const mineOt = isPt ? (ptf === 'mine' ? me : null) : (ptf === 'all' ? null : ptf)
  const training = appts.filter(a => isTraining(a) && holdsSlot(a))
  const onDay = (d: Date, ot: string | null = mineOt) => training.filter(a => sameDay(new Date(a.appointment_date), d) && (!ot || a.ot_id === ot))
  const count = (d: Date, ot: string | null = mineOt, sts?: string[]) => onDay(d, ot).filter(a => !sts || sts.includes(queueState(a, today))).length

  const book = async () => {
    if (!bk || !bkPatient) return
    setSaving(true); setError('')
    try {
      await api('/api/appointments', { method: 'POST', body: { patientId: bkPatient, otId: me, appointmentDate: slotDate(sel, bk).toISOString(), appointmentType: 'TRAINING', durationMin: SLOT_MIN, createdBy: user.users_id } })
      setBk(null); setBkPatient(''); await load()
    } catch (e) { setError((e as Error).message) }
    setSaving(false)
  }

  if (loading) return <Loading />

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
  const openDay = (d: Date) => { setSel(d); setDayOpen(true); setBk(null); setBkPatient(''); setError('') }

  /* ---------- รายละเอียดวัน ---------- */
  if (dayOpen) {
    const closed = isClosedDay(sel)
    const past = sel < today
    const nowHHMM = hhmm(new Date())
    const nAll = count(sel, null)
    const nMine = count(sel, me)
    const myPatientsToday = new Set(onDay(sel, null).map(a => a.patient_id))
    const warn = bkPatient && myPatientsToday.has(bkPatient) ? 'ผู้ป่วยคนนี้มีนัดในวันนี้อยู่แล้ว' : ''
    const stats: [string, string, string][] = isPt
      ? [['นัดของฉัน', `${nMine} นัด`, '#16365F'], ['ช่องกระดานที่ยังว่าง', `${SLOTS.length - nAll} ช่อง`, '#2E8A0B'], ['นัดทั้งศูนย์', `${nAll}/${SLOTS.length}`, '#4D53E0']]
      : [
          ['นัดทั้งหมด', `${count(sel)} นัด`, '#16365F'],
          [sel > today ? 'ยืนยันนัดแล้ว' : 'มารักษาแล้ว', `${count(sel, mineOt, sel > today ? ['booked'] : ['done'])} คน`, '#2E8A0B'],
          mineOt
            ? [past ? 'ไม่มาตามนัด' : 'รอ / ยังไม่มา', `${count(sel, mineOt, past ? ['noshow'] : ['wait', 'notyet', 'now'])} คน`, '#4D53E0']
            : ['ช่องว่าง', `${SLOTS.length - nAll} ช่อง`, '#4D53E0'],
        ]

    return (
      <>
        <h1 className="m-0 text-[30px] font-semibold">ตารางนัด</h1>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <button type="button" onClick={() => setDayOpen(false)} className="flex h-10 items-center gap-1.5 rounded-lg border border-rx-line bg-white px-3.5 text-[13px] font-semibold"><ChevronLeft size={16} />กลับไปปฏิทิน</button>
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
        <ErrorText>{error}</ErrorText>
        {closed ? (
          <div className="rounded-lg bg-white p-6 text-[15px] text-rx-muted">ศูนย์ปิดวันอาทิตย์ ไม่มีนัดในวันนี้</div>
        ) : (
          <div className="flex flex-col gap-[18px]">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              {stats.map(([l, v, c]) => (
                <div key={l} className="flex flex-col gap-1 rounded-lg bg-white px-6 py-5">
                  <span className="text-[14px] text-rx-muted">{l}</span>
                  <span className="text-[30px] font-semibold" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>

            {isPt && bk && (
              <div className="flex flex-col gap-3 rounded-lg border-[1.5px] border-rx-tint-2 bg-white px-5 py-[18px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-semibold">ลงนัดช่อง {slotLabel(bk)} · {dayMonth(sel)}</span>
                  <button type="button" onClick={() => setBk(null)} className="h-9 rounded-lg border border-rx-line bg-white px-3 text-[13px] font-semibold">ยกเลิก</button>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-[1_1_260px] flex-col gap-1.5">
                    <label htmlFor="bkp" className="text-[13px] font-semibold">ผู้ป่วย (เคสของฉัน)</label>
                    <select id="bkp" value={bkPatient} onChange={e => setBkPatient(e.target.value)} className={selectCls}>
                      <option value="">เลือกผู้ป่วย</option>
                      {myCases.map(p => <option key={p.patient_id} value={p.patient_id}>{fullName(p.first_name, p.last_name)} · HN {p.patient_id}</option>)}
                    </select>
                  </div>
                  <Btn onClick={book} disabled={!bkPatient || !!warn || saving}>{saving ? 'กำลังบันทึก...' : 'ยืนยันนัด'}</Btn>
                </div>
                {warn && <div className="rounded-lg bg-[#FFF0D9] px-3.5 py-2.5 text-[13px] text-[#8C420A]">{warn}</div>}
                <span className="text-[12px] text-rx-muted">ช่องนี้กระดานว่าง ไม่มีนัดของผู้ป่วยหรือนักกายภาพคนอื่น</span>
              </div>
            )}

            <div className="overflow-x-auto rounded-lg bg-white">
              <div className="min-w-[760px]">
                <div className="grid items-center gap-2.5 px-5 py-3.5 text-[12px] uppercase tracking-[0.03em] text-rx-muted" style={{ gridTemplateColumns: isPt ? '130px minmax(0,1.6fr) minmax(0,1fr) 130px 110px' : '130px minmax(0,1.6fr) 110px minmax(0,1fr) 130px' }}>
                  {(isPt ? ['ช่วงเวลา', 'ผู้ป่วย', 'นักกายภาพ', 'สถานะ', ''] : ['ช่วงเวลา', 'ผู้ป่วย', 'HN', 'นักกายภาพ', 'ติดตามการรักษา']).map((h, i) => <span key={i}>{h}</span>)}
                </div>
                {SLOTS.map((x, i) => {
                  const a = trainingAt(training, sel, x.s)
                  const hidden = mineOt && (!a || a.ot_id !== mineOt) && !(isPt && !a)
                  const st = a ? queueState(a, today) : null
                  const canBook = isPt && !a && !past && !(sameDay(sel, today) && x.s < nowHHMM)
                  const cols = isPt ? '130px minmax(0,1.6fr) minmax(0,1fr) 130px 110px' : '130px minmax(0,1.6fr) 110px minmax(0,1fr) 130px'
                  return (
                    <div key={x.s}>
                      {i === LUNCH_BEFORE && !mineOt && (
                        <div className="grid items-center gap-2.5 bg-rx-bg px-5 py-3.5 text-[14px] text-rx-muted" style={{ gridTemplateColumns: cols }}><span>12:00 – 13:00</span><span>พักกลางวัน</span></div>
                      )}
                      {!hidden && (
                        <div className={`grid items-center gap-2.5 border-t border-rx-divider px-5 py-3.5 text-[14px] ${bk === x.s ? 'bg-rx-tint' : ''}`} style={{ gridTemplateColumns: cols }}>
                          <span className="font-semibold">{slotLabel(x.s)}</span>
                          <span className={a ? 'font-semibold' : 'text-rx-muted'}>{a ? fullName(a.patient_name, a.patient_lastname) : 'ว่าง'}</span>
                          {!isPt && <span className="text-rx-muted">{a?.patient_id ?? ''}</span>}
                          <span>{a ? ptName(a.therapist_name) : '–'}</span>
                          <div>{st && <Badge state={st} />}</div>
                          {isPt && <div>{canBook && <button type="button" onClick={() => { setBk(x.s); setBkPatient('') }} className="h-9 rounded-lg border border-rx-accent bg-white px-3.5 text-[13px] font-semibold text-rx-accent-ink">ลงนัด</button>}</div>}
                        </div>
                      )}
                    </div>
                  )
                })}
                {mineOt && !isPt && onDay(sel).length === 0 && <div className="p-5 text-[14px] text-rx-muted">ไม่มีนัดของนักกายภาพคนนี้ในวันนี้</div>}
              </div>
            </div>
            <Notice>
              {isPt
                ? 'กระดานมีเครื่องเดียว ใช้ร่วมกันทุกนักกายภาพ · ลงนัดได้เฉพาะช่องที่ยังไม่มีใครใช้ จึงไม่ชนกับผู้ป่วยหรือนักกายภาพคนอื่น'
                : 'การนัดหมายทำโดยนักกายภาพเท่านั้น · เวชระเบียนดูได้อย่างเดียว'}
            </Notice>
          </div>
        )}
      </>
    )
  }

  /* ---------- ปฏิทิน ---------- */
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) { const d = addDays(gridStart, i); if (i >= 35 && d.getMonth() !== first.getMonth()) break; cells.push(d) }
  const monthMeta = (d: Date): { meta: string; meta2: string; bg: string; c: string; c2?: string } => {
    if (isClosedDay(d)) return { meta: 'ปิด', meta2: '', bg: '#EEF1F6', c: '#4A5B6E' }
    const all = count(d, null)
    if (isPt) {
      const my = count(d, me), free = SLOTS.length - all
      return {
        meta: my ? `นัดของฉัน ${my}` : 'ไม่มีนัดของฉัน', bg: my ? '#EDEEFC' : '#F7F8FB', c: my ? '#3A40C9' : '#5B738B',
        meta2: d < today ? '' : ptf === 'mine' ? (free ? `กระดานว่าง ${free}` : 'กระดานเต็ม') : `ทั้งศูนย์ ${all}/${SLOTS.length}`,
        c2: free ? '#2E8A0B' : '#791F1F',
      }
    }
    if (mineOt) { const n = count(d); return { meta: n ? `นัด ${n}` : 'ไม่มีนัด', meta2: '', bg: n ? '#EDEEFC' : '#F7F8FB', c: n ? '#3A40C9' : '#5B738B' } }
    return {
      meta: all >= SLOTS.length ? 'เต็ม' : d < today ? `มา ${count(d, null, ['done'])}` : `จอง ${all}/${SLOTS.length}`, meta2: '',
      bg: all >= SLOTS.length ? '#FCEBEB' : all >= SLOTS.length - 1 ? '#FFF0D9' : '#E4F5EC', c: all >= SLOTS.length ? '#791F1F' : all >= SLOTS.length - 1 ? '#8C420A' : '#145C38',
    }
  }
  const sunday = addDays(monday, 6)

  return (
    <>
      <div className="flex flex-col">
        <h1 className="m-0 text-[30px] font-semibold">ตารางนัด</h1>
        {isPt && <span className="text-[13px] text-rx-muted">ดูเป็นรายเดือนหรือรายสัปดาห์ · ลงนัดได้ในช่องที่กระดานว่าง</span>}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <IconBtn label="ก่อนหน้า" dir="prev" onClick={() => (view === 'month' ? setMo(mo - 1) : setWk(wk - 1))} />
            <span className="min-w-[200px] text-center text-[18px] font-semibold">
              {view === 'month' ? `${MONTH[first.getMonth()]} ${first.getFullYear() + 543}` : `${dayMonth(monday)} – ${dayMonth(sunday)} ${sunday.getFullYear() + 543}`}
            </span>
            <IconBtn label="ถัดไป" dir="next" onClick={() => (view === 'month' ? setMo(mo + 1) : setWk(wk + 1))} />
            <button type="button" onClick={() => { setMo(0); setWk(0); setSel(today) }} className="h-10 whitespace-nowrap rounded-lg border border-rx-line bg-white px-3.5 text-[13px] font-semibold">วันนี้</button>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {isPt && filterSelect('ptsel1')}
            <div className="flex overflow-hidden rounded-lg border border-rx-line bg-white">
              <button type="button" onClick={() => setView('month')} className={tgl(view === 'month')}>เดือน</button>
              <button type="button" onClick={() => setView('week')} className={tgl(view === 'week')}>สัปดาห์</button>
            </div>
          </div>
        </div>
        {!isPt && <div className="flex flex-wrap items-center justify-between gap-2.5">{filterSelect('ptsel1')}</div>}

        {view === 'month' ? (
          <div className="flex min-w-0 flex-col gap-3 rounded-lg bg-white p-3.5">
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
                    className={`flex min-h-[78px] flex-col items-start justify-between gap-1 rounded-lg p-2 text-left ${inM ? 'text-rx-ink' : 'text-rx-faint'} ${isT ? 'border-2 border-rx-accent bg-white' : `border border-rx-soft ${inM ? 'bg-white' : 'bg-rx-bg'}`}`}
                  >
                    <span className="text-[14px] font-semibold">{d.getDate()}</span>
                    {inM && <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: m.bg, color: m.c }}>{m.meta}</span>}
                    {inM && m.meta2 && <span className="text-[11px]" style={{ color: m.c2 }}>{m.meta2}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-white p-3">
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
                    {isClosedDay(d) && <span className="py-2 text-center text-[12px] text-rx-muted">ปิด</span>}
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
