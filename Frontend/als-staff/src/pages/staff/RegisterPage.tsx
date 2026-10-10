import { useEffect, useMemo, useState } from 'react'
import { Search, CalendarCheck } from 'lucide-react'
import type { AuthUser, Patient, PatientAppointment, Therapist } from '../../types'
import {
  api, list, SLOTS, slotDate, slotLabel, apptSlot, sameDay, thaiDate, thaiShort, hhmm, isClosedDay,
  isTraining, holdsSlot, queueState, BADGE, stageLabel, ptName, fullName, initials,
} from '../../lib/clinic'
import { Card, CardTitle, Btn, Field, inputCls, selectCls, textareaCls, readonlyCls, ErrorText, Loading, Badge } from '../../components/ui'

interface Props { user: AuthUser; onDone: () => void }

const ONSET = ['น้อยกว่า 1 เดือน', '1–6 เดือน', '6–12 เดือน', 'มากกว่า 1 ปี']
const EMPTY_NEW = {
  firstName: '', lastName: '', birthDate: '', gender: 'ไม่ระบุ', phone: '', weight: '', address: '',
  caretakerName: '', caretakerPhone: '',
  chiefComplaint: '', painLevel: '0', symptomLocation: '', onsetDuration: ONSET[0],
}

export default function RegisterPage({ user, onDone }: Props) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [therapists, setTherapists] = useState<Therapist[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [ran, setRan] = useState('')
  const [who, setWho] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  // ผู้ป่วยเก่า: ช่องที่แก้ได้
  const [edit, setEdit] = useState({ phone: '', weight: '', caretakerPhone: '', symptoms: '', primaryOt: '' })
  // ผู้ป่วยใหม่
  const [form, setForm] = useState(EMPTY_NEW)
  const [pick, setPick] = useState<{ s: string; ot: string } | null>(null)

  const load = () => Promise.all([
    list<Patient>('/api/patients?status=ALL').then(setPatients),
    list<PatientAppointment>('/api/appointments').then(setAppts),
    list<Therapist>('/api/therapists').then(setTherapists),
  ]).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const lastVisit = useMemo(() => {
    const m = new Map<string, { n: number; last: Date | null }>()
    for (const a of appts) {
      if (a.status !== 'COMPLETED' || !isTraining(a)) continue
      const cur = m.get(a.patient_id) ?? { n: 0, last: null }
      const d = new Date(a.appointment_date)
      m.set(a.patient_id, { n: cur.n + 1, last: !cur.last || d > cur.last ? d : cur.last })
    }
    return m
  }, [appts])

  const term = ran.trim().toLowerCase()
  const hits = term
    ? patients.filter(p => fullName(p.first_name, p.last_name).toLowerCase().includes(term) || p.patient_id.toLowerCase().includes(term))
    : []
  const found = patients.find(p => p.patient_id === who) ?? null
  const todayAppt = found ? appts.find(a => a.patient_id === found.patient_id && isTraining(a) && holdsSlot(a) && sameDay(new Date(a.appointment_date), today)) : undefined
  const canCheckIn = todayAppt?.status === 'SCHEDULED'
  // ไม่มีเคสที่เปิดอยู่ (ปิดเคสไปแล้ว) → ต้องเปิดเคสใหม่ก่อน
  const needsNewCase = !!found && (!found.case_id || found.case_status === 'CLOSED')

  const choose = (p: Patient) => {
    setWho(p.patient_id)
    setEdit({ phone: p.phone ?? '', weight: p.weight ? String(Number(p.weight)) : '', caretakerPhone: p.caretaker_phone ?? '', symptoms: '', primaryOt: p.primary_ot_id ?? '' })
    setForm(EMPTY_NEW); setPick(null); setError(''); setSavedMsg('')
  }
  const search = () => { setRan(q); setWho(null); setError(''); setSavedMsg('') }
  const clear = () => { setQ(''); setRan(''); setWho(null); setError('') }

  const savePatient = async () => {
    if (!found) return
    await api('/api/register', {
      method: 'PATCH',
      body: { patientId: found.patient_id, usersId: found.users_id, phone: edit.phone, caretakerPhone: edit.caretakerPhone, ...(needsNewCase ? {} : { primaryOtId: edit.primaryOt }) },
    })
  }

  const checkIn = async () => {
    if (!found || !todayAppt) return
    setSaving(true); setError('')
    try {
      await savePatient()
      await api('/api/appointments', {
        method: 'PATCH',
        body: { appointmentId: todayAppt.appointment_id, action: 'CHECK_IN', checkedInBy: user.users_id, symptomsToday: edit.symptoms, weightKg: edit.weight },
      })
      onDone()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  const saveOnly = async () => {
    setSaving(true); setError('')
    try { await savePatient(); await load(); setSavedMsg('บันทึกการแก้ไขข้อมูลแล้ว') }
    catch (e) { setError((e as Error).message) }
    setSaving(false)
  }

  // ผู้ป่วยเก่าที่ปิดเคสแล้วกลับมาใหม่ → เปิดเคสใหม่ (ซักประวัติ + นัดประเมิน) ประวัติคอร์สเดิมยังอยู่
  const openNewCase = async () => {
    if (!found || !pick) return
    setSaving(true); setError('')
    try {
      await savePatient()
      await api('/api/register', {
        method: 'POST',
        body: {
          patientId: found.patient_id, chiefComplaint: form.chiefComplaint, painLevel: form.painLevel, symptomLocation: form.symptomLocation,
          onsetDuration: form.onsetDuration, weight: edit.weight, checkedInBy: user.users_id,
          assessment: { otId: pick.ot, appointmentDate: slotDate(today, pick.s).toISOString() },
        },
      })
      onDone()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  const registerNew = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('กรอกชื่อและนามสกุลของผู้ป่วย'); return }
    if (!pick) return
    setSaving(true); setError('')
    try {
      await api('/api/register', {
        method: 'POST',
        body: { ...form, checkedInBy: user.users_id, assessment: { otId: pick.ot, appointmentDate: slotDate(today, pick.s).toISOString() } },
      })
      onDone()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  if (loading) return <Loading />

  const setF = (k: keyof typeof EMPTY_NEW) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }))
  const nowHHMM = hhmm(now)
  const busyLabel = (otId: string, s: string) => {
    const a = appts.find(x => x.ot_id === otId && holdsSlot(x) && sameDay(new Date(x.appointment_date), today) && apptSlot(x) === s)
    return a ? `${a.appointment_type === 'ASSESSMENT' ? 'ประเมิน · ' : ''}${fullName(a.patient_name, a.patient_lastname)}` : null
  }

  const infoCard = found && (
    <Card>
      <span className="text-[16px] font-semibold">ข้อมูลผู้ป่วย</span>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <RO label="ชื่อ" value={found.first_name} />
        <RO label="นามสกุล" value={found.last_name} />
        <RO label="วันเดือนปีเกิด" value={found.birth_date ? thaiShort(new Date(found.birth_date)) : ''} />
        <RO label="เพศ" value={found.gender} />
        <Field label="เบอร์โทร" hint="แก้ไขได้" htmlFor="otel">
          <input id="otel" className={`${inputCls} border-[1.5px] border-rx-tint-2`} value={edit.phone} onChange={e => setEdit(s => ({ ...s, phone: e.target.value }))} />
        </Field>
        <Field label="น้ำหนัก (กก.)" hint="แก้ไขได้" htmlFor="owt">
          <input id="owt" inputMode="decimal" className={`${inputCls} border-[1.5px] border-rx-tint-2`} value={edit.weight} onChange={e => setEdit(s => ({ ...s, weight: e.target.value }))} />
        </Field>
        <RO label="ที่อยู่" value={found.address} className="sm:col-span-2" />
        <RO label="ชื่อผู้ดูแล" value={found.caretaker_name} />
        <Field label="เบอร์ผู้ดูแล" hint="แก้ไขได้" htmlFor="ocgt">
          <input id="ocgt" className={`${inputCls} border-[1.5px] border-rx-tint-2`} value={edit.caretakerPhone} onChange={e => setEdit(s => ({ ...s, caretakerPhone: e.target.value }))} />
        </Field>
      </div>
    </Card>
  )
  const intakeCard = (
    <Card className="gap-3.5 px-5 py-[18px]">
      <CardTitle sub="บันทึกตามที่ผู้ป่วยเล่า · ระยะของโรคจะประเมินโดยนักกายภาพ">ซักประวัติเบื้องต้น</CardTitle>
      <div className="flex flex-wrap gap-3.5">
        <Field label="อาการที่มาพบ / ความเจ็บปวด" htmlFor="sym2" className="w-full">
          <textarea id="sym2" rows={2} className={textareaCls} placeholder="เช่น มือซ้ายอ่อนแรง หยิบจับของลำบาก ปวดตึงไหล่" value={form.chiefComplaint} onChange={setF('chiefComplaint')} />
        </Field>
        <Field label="ระดับความเจ็บปวด (0 = ไม่ปวด, 10 = ปวดมากที่สุด)" htmlFor="pain" className="flex-[1_1_300px]">
          <select id="pain" className={selectCls} value={form.painLevel} onChange={setF('painLevel')}>
            {Array.from({ length: 11 }, (_, i) => <option key={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="ตำแหน่งที่มีอาการ" htmlFor="loc" className="flex-[1_1_240px]">
          <input id="loc" className={inputCls} placeholder="เช่น มือซ้าย ไหล่ซ้าย" value={form.symptomLocation} onChange={setF('symptomLocation')} />
        </Field>
        <Field label="เริ่มมีอาการมานาน" htmlFor="onset" className="flex-[1_1_240px]">
          <select id="onset" className={selectCls} value={form.onsetDuration} onChange={setF('onsetDuration')}>
            {ONSET.map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
    </Card>
  )
  const slotCard = (
    <Card className="gap-3.5 px-5 py-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[16px] font-semibold">ลงเวลาพบนักกายภาพเพื่อประเมิน · วันนี้</span>
        <span className="text-[12px] text-rx-muted">ตอนนี้ {nowHHMM} น. · ไม่ใช้กระดาน เลือกช่องที่นักกายภาพว่าง</span>
      </div>
      {isClosedDay(today) ? (
        <span className="text-[14px] text-rx-muted">ศูนย์ปิดวันอาทิตย์ · ให้นัดมาประเมินวันอื่น</span>
      ) : therapists.length === 0 ? (
        <span className="text-[14px] text-rx-muted">ยังไม่มีนักกายภาพในระบบ</span>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-rx-soft">
          <div style={{ minWidth: 130 + therapists.length * 215 }}>
            <div className="grid gap-2 bg-rx-bg px-3.5 py-2.5 text-[12px] uppercase tracking-[0.03em] text-rx-muted" style={{ gridTemplateColumns: `130px repeat(${therapists.length}, minmax(0, 1fr))` }}>
              <span>ช่วงเวลา</span>
              {therapists.map(t => <span key={t.ot_id}>{ptName(t.first_name)}</span>)}
            </div>
            {SLOTS.map(x => {
              const past = x.s < nowHHMM
              return (
                <div key={x.s} className="grid items-center gap-2 border-t border-rx-divider px-3.5 py-2" style={{ gridTemplateColumns: `130px repeat(${therapists.length}, minmax(0, 1fr))` }}>
                  <span className={past ? 'text-rx-faint' : 'font-semibold'}>{slotLabel(x.s)}</span>
                  {therapists.map(t => {
                    const busy = busyLabel(t.ot_id, x.s)
                    const on = pick?.s === x.s && pick.ot === t.ot_id
                    const base = 'min-h-10 w-full rounded-lg px-2.5 py-1.5 text-left text-[13px]'
                    if (past) return <span key={t.ot_id} className={`${base} text-rx-faint`}>ผ่านไปแล้ว</span>
                    if (busy) return <span key={t.ot_id} className={`${base} truncate bg-rx-bg text-rx-muted`}>ติด · {busy}</span>
                    return (
                      <button key={t.ot_id} type="button" onClick={() => setPick({ s: x.s, ot: t.ot_id })} className={`${base} font-semibold ${on ? 'border-[1.5px] border-rx-accent bg-rx-accent text-white' : 'border border-[#A7DDB1] bg-[#E4F5EC] text-[#145C38]'}`}>
                        {on ? 'เลือกแล้ว ✓' : 'ว่าง · เลือกเวลานี้'}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {pick ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-rx-tint px-4 py-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rx-accent text-white"><CalendarCheck size={20} /></div>
          <div className="flex flex-col">
            <span className="text-[12px] text-rx-accent-deep">นัดประเมินวันนี้</span>
            <span className="text-[17px] font-semibold">{slotLabel(pick.s)} น. กับ {ptName(therapists.find(t => t.ot_id === pick.ot)?.first_name)}</span>
          </div>
        </div>
      ) : (
        <span className="text-[13px] text-rx-muted">ยังไม่ได้เลือกเวลา · ถ้าวันนี้ไม่มีนักกายภาพว่างเลย ให้นัดมาประเมินวันอื่น</span>
      )}
    </Card>
  )
  const assessButton = (label: string, onClick: () => void) => (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      {pick
        ? <Btn onClick={onClick} disabled={saving}>{saving ? 'กำลังบันทึก...' : label}</Btn>
        : <Btn disabled>เลือกเวลาประเมินก่อนบันทึก</Btn>}
    </div>
  )

  return (
    <>
      <div className="flex flex-col">
        <h1 className="m-0 text-[30px] font-semibold">ลงทะเบียนผู้ป่วย</h1>
        <span className="text-[13px] text-rx-muted">รับผู้ป่วยทุกครั้งที่มารักษา · ค้นหาเพื่อดึงข้อมูลผู้ป่วยเก่า หรือกรอกใหม่สำหรับผู้ป่วยที่มาครั้งแรก</span>
      </div>

      <Card className="gap-3 px-5 py-[18px]">
        <label htmlFor="q" className="text-[15px] font-semibold">ค้นหาผู้ป่วย</label>
        <form className="flex flex-wrap gap-2.5" onSubmit={e => { e.preventDefault(); search() }}>
          <div className="flex h-12 flex-[1_1_360px] items-center gap-2.5 rounded-lg border-[1.5px] border-rx-accent bg-white px-3.5">
            <Search size={18} className="text-rx-muted" />
            <input id="q" value={q} onChange={e => setQ(e.target.value)} placeholder="พิมพ์ชื่อ หรือ HN เช่น สมชาย, PAT000001" className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-rx-ink outline-none" />
            {q && <button type="button" aria-label="ล้างการค้นหา" onClick={clear} className="h-8 w-8 rounded-lg bg-rx-divider text-[16px]">×</button>}
          </div>
          <button type="submit" className="h-12 rounded-lg bg-rx-accent px-6 text-[15px] font-semibold text-white">ค้นหา</button>
        </form>
        {ran && !found && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-rx-muted">
              {hits.length ? `พบ ${hits.length} คน สำหรับ "${ran}" · คลิกเพื่อเลือกผู้ป่วย` : `ไม่พบ "${ran}" ในระบบ · ถ้ามาครั้งแรกให้กรอกข้อมูลด้านล่างเพื่อลงทะเบียนใหม่`}
            </span>
            {hits.map(p => {
              const lv = lastVisit.get(p.patient_id)
              return (
                <button key={p.patient_id} type="button" onClick={() => choose(p)} className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-rx-soft bg-white px-3.5 py-2.5 text-left hover:border-rx-tint-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rx-tint text-[14px] font-semibold text-rx-accent-ink">{initials(p.first_name)}</div>
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="text-[15px] font-semibold">{fullName(p.first_name, p.last_name)}</span>
                    <span className="text-[12px] text-rx-muted">HN {p.patient_id} · {stageLabel(p.current_stage)} · {ptName(p.primary_ot_name)} · มาล่าสุด {lv?.last ? thaiShort(lv.last) : '–'}</span>
                  </div>
                  <Badge label="เลือก" bg="#EDEEFC" fg="#3A40C9" className="px-3.5 py-1 text-[13px]" />
                </button>
              )
            })}
          </div>
        )}
      </Card>

      <ErrorText>{error}</ErrorText>

      {found ? (
        <div className="flex flex-col gap-[18px]">
          <Card className="border-rx-tint-2">
            <div className="flex flex-wrap items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rx-tint text-[16px] font-semibold text-rx-accent-ink">{initials(found.first_name)}</div>
              <div className="flex flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-[18px] font-semibold">{fullName(found.first_name, found.last_name)} · HN {found.patient_id}</span>
                <span className="text-[13px] text-rx-muted">
                  ข้อมูลที่เคยลงทะเบียนไว้ · มารักษาแล้ว {lastVisit.get(found.patient_id)?.n ?? 0} ครั้ง · ล่าสุด {lastVisit.get(found.patient_id)?.last ? thaiShort(lastVisit.get(found.patient_id)!.last!) : '–'}
                </span>
              </div>
            </div>
          </Card>

          {needsNewCase ? (
            <>
              <div className="rounded-lg bg-rx-tint px-4 py-3.5 text-[14px] leading-relaxed text-rx-accent-deep">
                <span className="font-semibold">เคสเดิมเสร็จสิ้นการรักษาแล้ว{found.case_closed_at ? ` (${thaiShort(new Date(found.case_closed_at))})` : ''} · เปิดเคสใหม่</span><br />
                ซักประวัติใหม่และนัดประเมินกับนักกายภาพ ประวัติคอร์สเดิมยังอยู่ครบ
              </div>
              {infoCard}
              {intakeCard}
              {slotCard}
              {assessButton('เปิดเคสใหม่และส่งให้นักกายภาพประเมิน', openNewCase)}
            </>
          ) : (
            <>
              <Card className="px-5 py-[18px]">
                <span className="text-[16px] font-semibold">วันนัด</span>
                {todayAppt ? (
                  <div className="flex flex-wrap items-center gap-3.5 rounded-lg bg-rx-tint px-4 py-3.5">
                    <div className="flex flex-[1_1_220px] flex-col gap-0.5">
                      <span className="text-[12px] text-rx-accent-deep">นัดวันนี้</span>
                      <span className="text-[20px] font-semibold">{slotLabel(apptSlot(todayAppt))} น.</span>
                      <span className="text-[13px] text-rx-muted">{thaiDate(today)} · {ptName(todayAppt.therapist_name)} · {BADGE[queueState(todayAppt)][0]}</span>
                    </div>
                    <span className="rounded-full bg-rx-accent px-3.5 py-1 text-[13px] font-semibold text-white">ตรงกับนัด</span>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[#FCEBEB] px-4 py-3.5 text-[14px] leading-relaxed text-[#791F1F]">
                    <span className="font-semibold">วันนี้ไม่มีนัด · รับเข้าคิวไม่ได้</span><br />
                    ผู้ป่วยต้องมาตามวันนัดที่นักกายภาพลงไว้เท่านั้น ถ้าต้องการเลื่อนนัดให้ติดต่อนักกายภาพ
                  </div>
                )}
              </Card>

              {infoCard}

              <Card>
                <span className="text-[16px] font-semibold">ข้อมูลการรักษาครั้งนี้</span>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <RO label="ระยะอาการ (ประเมินโดยนักกายภาพ)" value={stageLabel(found.current_stage)} />
                  <RO label="ข้างที่เป็นโรค" value={found.affected_side} />
                  <Field label="อาการวันนี้" hint="กรอกทุกครั้งที่มา" htmlFor="osym" className="sm:col-span-2">
                    <textarea id="osym" rows={2} className={`${textareaCls} border-[1.5px] border-rx-tint-2`} placeholder="เช่น แขนขวาล้าเร็วกว่าเดิม" value={edit.symptoms} onChange={e => setEdit(s => ({ ...s, symptoms: e.target.value }))} />
                  </Field>
                </div>
              </Card>

              <Card>
                <span className="text-[16px] font-semibold">ผู้ดูแลเคส (นักกายภาพ)</span>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <select aria-label="ผู้ดูแลเคส" className={`${selectCls} border-[1.5px] border-rx-tint-2`} value={edit.primaryOt} onChange={e => setEdit(s => ({ ...s, primaryOt: e.target.value }))}>
                    <option value="">ยังไม่ระบุ</option>
                    {therapists.map(t => <option key={t.ot_id} value={t.ot_id}>{ptName(t.first_name)}</option>)}
                  </select>
                </div>
              </Card>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {savedMsg && <span className="text-[13px] font-semibold text-[#145C38]">{savedMsg}</span>}
                <span className="text-[12px] text-rx-muted">ช่องสีเทาเป็นข้อมูลเดิม แก้ไม่ได้</span>
                {canCheckIn ? (
                  <Btn onClick={checkIn} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกและรับผู้ป่วยเข้าคิว'}</Btn>
                ) : (
                  <>
                    <Btn variant="outline" onClick={saveOnly} disabled={saving}>บันทึกการแก้ไขข้อมูล</Btn>
                    <Btn disabled>{todayAppt ? `${BADGE[queueState(todayAppt)][0]} · รับคิวแล้ว` : 'รับเข้าคิวไม่ได้ (ไม่มีนัดวันนี้)'}</Btn>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-[18px]">
          <Card>
            <span className="text-[16px] font-semibold">ข้อมูลผู้ป่วย</span>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <Field label="ชื่อ" htmlFor="fn"><input id="fn" className={inputCls} value={form.firstName} onChange={setF('firstName')} /></Field>
              <Field label="นามสกุล" htmlFor="ln"><input id="ln" className={inputCls} value={form.lastName} onChange={setF('lastName')} /></Field>
              <Field label="วันเดือนปีเกิด" htmlFor="dob"><input id="dob" type="date" className={inputCls} value={form.birthDate} onChange={setF('birthDate')} /></Field>
              <Field label="เพศ" htmlFor="sex">
                <select id="sex" className={selectCls} value={form.gender} onChange={setF('gender')}><option>ไม่ระบุ</option><option>ชาย</option><option>หญิง</option></select>
              </Field>
              <Field label="เบอร์โทร" htmlFor="tel"><input id="tel" className={inputCls} placeholder="08x-xxx-xxxx" value={form.phone} onChange={setF('phone')} /></Field>
              <Field label="น้ำหนัก (กก.)" htmlFor="wt"><input id="wt" inputMode="decimal" className={inputCls} placeholder="เช่น 55" value={form.weight} onChange={setF('weight')} /></Field>
              <Field label="ที่อยู่" htmlFor="addr" className="sm:col-span-2"><input id="addr" className={inputCls} value={form.address} onChange={setF('address')} /></Field>
              <Field label="ชื่อผู้ดูแล" htmlFor="cg"><input id="cg" className={inputCls} value={form.caretakerName} onChange={setF('caretakerName')} /></Field>
              <Field label="เบอร์ผู้ดูแล" htmlFor="cgt"><input id="cgt" className={inputCls} placeholder="08x-xxx-xxxx" value={form.caretakerPhone} onChange={setF('caretakerPhone')} /></Field>
            </div>
          </Card>

          {intakeCard}
          {slotCard}
          {assessButton('บันทึกและส่งให้นักกายภาพประเมิน', registerNew)}
        </div>
      )}
    </>
  )
}

function RO({ label, value, className = '' }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[13px] font-semibold text-rx-muted">{label}</span>
      <input readOnly aria-label={label} value={value ?? ''} className={readonlyCls} />
    </div>
  )
}
