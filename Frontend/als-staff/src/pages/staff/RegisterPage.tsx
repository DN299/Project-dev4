import { useEffect, useMemo, useState } from 'react'
import { Search, Pencil, Save } from 'lucide-react'
import type { AuthUser, Patient, PatientAppointment, Therapist } from '../../types'
import {
  api, list, sameDay, thaiShort,
  isTraining, holdsSlot, stageLabel, ptName, fullName, initials, ageFrom,
} from '../../lib/clinic'
import { Card, CardTitle, Btn, Field, inputCls, selectCls, textareaCls, readonlyCls, ErrorText, Loading } from '../../components/ui'
import { EMPTY_PROFILE, PersonFields, fullAddress, profileOf, profileBody } from '../../components/PatientForm'

interface Props { user: AuthUser; onDone: () => void }

const ONSET = ['น้อยกว่า 1 เดือน', '1–6 เดือน', '6–12 เดือน', 'มากกว่า 1 ปี']
// ตรงกับตัวเลือก "ข้างที่เป็นโรค" ในหน้าประเมินของนักกายภาพ
const SIDES = ['ข้างซ้าย', 'ข้างขวา', 'ทั้งสองข้าง']
const EMPTY_NEW = {
  titleName: '', firstName: '', lastName: '', birthDate: '', gender: 'ไม่ระบุ', phone: '', weight: '',
  address: '', subdistrict: '', district: '', province: '',
  chiefComplaint: '', painLevel: '0', affectedSide: '', onsetDuration: ONSET[0],
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
  const [edit, setEdit] = useState({ weight: '', symptoms: '', primaryOt: '' })
  // แก้ข้อมูลผู้ป่วย (กดดินสอ)
  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState(EMPTY_PROFILE)
  // ผู้ป่วยใหม่
  const [form, setForm] = useState(EMPTY_NEW)

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
    setEdit({ weight: p.weight ? String(Number(p.weight)) : '', symptoms: '', primaryOt: p.primary_ot_id ?? '' })
    setEditing(false); setForm(EMPTY_NEW); setError(''); setSavedMsg('')
  }
  const search = () => { setRan(q); setWho(null); setError(''); setSavedMsg('') }
  const clear = () => { setQ(''); setRan(''); setWho(null); setError('') }

  // นักกายภาพประจำเคส (ข้อมูลผู้ป่วยบันทึกแยกที่ saveProfile)
  const savePatient = async () => {
    if (!found || needsNewCase) return
    await api('/api/register', {
      method: 'PATCH',
      body: { patientId: found.patient_id, usersId: found.users_id, primaryOtId: edit.primaryOt },
    })
  }

  const startEdit = () => {
    if (!found) return
    setProfile(profileOf(found))
    setEditing(true); setSavedMsg('')
  }

  const saveProfile = async () => {
    if (!found) return
    if (!profile.firstName.trim() || !profile.lastName.trim()) { setError('กรอกชื่อและนามสกุลของผู้ป่วย'); return }
    setSaving(true); setError('')
    try {
      await api('/api/register', {
        method: 'PATCH',
        body: profileBody(found, profile),
      })
      await load(); setEditing(false); setSavedMsg('บันทึกข้อมูลผู้ป่วยแล้ว')
    } catch (e) { setError((e as Error).message) }
    setSaving(false)
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
    if (!found) return
    setSaving(true); setError('')
    try {
      await savePatient()
      await api('/api/register', {
        method: 'POST',
        body: {
          patientId: found.patient_id, chiefComplaint: form.chiefComplaint, painLevel: form.painLevel, affectedSide: form.affectedSide,
          onsetDuration: form.onsetDuration, weight: edit.weight, checkedInBy: user.users_id,
        },
      })
      onDone()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  const registerNew = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) { setError('กรอกชื่อและนามสกุลของผู้ป่วย'); return }
    setSaving(true); setError('')
    try {
      await api('/api/register', {
        method: 'POST',
        body: { ...form, checkedInBy: user.users_id },
      })
      onDone()
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  if (loading) return <Loading />

  const setF = (k: keyof typeof EMPTY_NEW) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }))
  const setP = (k: keyof typeof EMPTY_PROFILE) => (e: { target: { value: string } }) => setProfile(f => ({ ...f, [k]: e.target.value }))
  const age = found ? ageFrom(found.birth_date) : null
  // แสดงข้อมูลทั้งหมดแบบอ่านอย่างเดียว · กดดินสอเพื่อแก้ไข
  const infoCard = found && (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[16px] font-semibold">ข้อมูลผู้ป่วย</span>
        {!editing && (
          <button type="button" onClick={startEdit} aria-label="แก้ไขข้อมูลผู้ป่วย" className="flex h-9 items-center gap-1.5 rounded-full rx-glass-control px-3 text-[13px] font-semibold text-rx-accent-ink hover:border-rx-tint-2">
            <Pencil size={15} />แก้ไข
          </button>
        )}
      </div>
      {editing ? (
        <>
          <PersonFields v={profile} set={setP} id="e" />
          <div className="flex flex-wrap justify-end gap-2.5">
            <Btn variant="outline" onClick={() => setEditing(false)} disabled={saving}>ยกเลิก</Btn>
            <Btn onClick={saveProfile} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลผู้ป่วย'}</Btn>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <RO label="ชื่อ" value={`${found.title_name ?? ''}${found.first_name ?? ''}`} />
          <RO label="นามสกุล" value={found.last_name} />
          <RO label="วันเดือนปีเกิด" value={found.birth_date ? thaiShort(new Date(found.birth_date)) : ''} />
          <RO label="อายุ" value={age != null ? `${age} ปี` : ''} />
          <RO label="เพศ" value={found.gender} />
          <RO label="เบอร์โทร" value={found.phone} />
          <RO label="ที่อยู่" value={fullAddress(found)} className="sm:col-span-2" />
        </div>
      )}
    </Card>
  )
  const intakeCard = (
    <Card className="gap-3.5 px-5 py-[18px]">
      <CardTitle>ซักประวัติเบื้องต้น</CardTitle>
      <div className="flex flex-wrap gap-3.5">
        <Field label="อาการที่มาพบ / ความเจ็บปวด" htmlFor="sym2" className="w-full">
          <textarea id="sym2" rows={2} className={textareaCls} placeholder="เช่น มือซ้ายอ่อนแรง หยิบจับของลำบาก ปวดตึงไหล่" value={form.chiefComplaint} onChange={setF('chiefComplaint')} />
        </Field>
        <Field label="ระดับความเจ็บปวด (0 = ไม่ปวด, 10 = ปวดมากที่สุด)" htmlFor="pain" className="flex-[1_1_300px]">
          <select id="pain" className={selectCls} value={form.painLevel} onChange={setF('painLevel')}>
            {Array.from({ length: 11 }, (_, i) => <option key={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="น้ำหนัก (กก.)" htmlFor="wt" className="flex-[1_1_240px]">
          {found
            ? <input id="wt" inputMode="decimal" className={inputCls} placeholder="เช่น 55" value={edit.weight} onChange={e => setEdit(s => ({ ...s, weight: e.target.value }))} />
            : <input id="wt" inputMode="decimal" className={inputCls} placeholder="เช่น 55" value={form.weight} onChange={setF('weight')} />}
        </Field>
        <fieldset className="flex w-full flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] font-semibold">ข้างที่มีอาการ</legend>
          <div className="flex flex-wrap gap-2.5">
            {SIDES.map(s => (
              <label key={s} className={`flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-[14px] ${form.affectedSide === s ? 'border-rx-accent bg-rx-tint font-semibold text-rx-accent-ink' : 'border-rx-line bg-white'}`}>
                <input type="radio" name="affectedSide" value={s} className="h-4 w-4 accent-[#007AFF]" checked={form.affectedSide === s} onChange={setF('affectedSide')} />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="เริ่มมีอาการมานาน" htmlFor="onset" className="flex-[1_1_240px]">
          <select id="onset" className={selectCls} value={form.onsetDuration} onChange={setF('onsetDuration')}>
            {ONSET.map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>
      </div>
    </Card>
  )
  // ลงทะเบียนอย่างเดียว ยังไม่ลงเวลา — เวชระเบียนเพิ่มเข้าคิวประเมินและเลือกนักกายภาพเองที่หน้าคิว
  const assessButton = (label: string, onClick: () => void) => (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <span className="text-[13px] text-rx-muted">บันทึกแล้วไปเพิ่มเข้าคิวประเมินที่หน้าคิวผู้ป่วย</span>
      <Btn onClick={onClick} disabled={saving}>{saving ? 'กำลังบันทึก...' : label}</Btn>
    </div>
  )

  return (
    <>
      <div className="flex flex-col">
        <h1 className="m-0 text-[28px] font-bold leading-tight">ลงทะเบียนผู้ป่วย</h1>
      </div>

      <Card className="gap-3 px-5 py-[18px]">
        <label htmlFor="q" className="text-[15px] font-semibold">ค้นหาผู้ป่วย</label>
        <form className="flex flex-wrap gap-2.5" onSubmit={e => { e.preventDefault(); search() }}>
          <div className="flex h-12 flex-[1_1_360px] items-center gap-2.5 rounded-field border-[1.5px] border-rx-accent bg-white px-3.5">
            <Search size={18} className="text-rx-muted" />
            <input id="q" value={q} onChange={e => setQ(e.target.value)} placeholder="พิมพ์ชื่อ หรือ HN เช่น สมชาย, PAT000001" className="min-w-0 flex-1 border-none bg-transparent text-[15px] text-rx-ink outline-none" />
            {q && <button type="button" aria-label="ล้างการค้นหา" onClick={clear} className="h-8 w-8 rounded-lg bg-rx-divider text-[16px]">×</button>}
          </div>
          <button type="submit" className="h-12 rounded-full bg-rx-accent px-6 text-[15px] font-semibold text-white">ค้นหา</button>
        </form>
        {ran && !found && (
          <div className="flex flex-col gap-2">
            {!hits.length && <span className="text-[13px] text-rx-muted">ไม่พบ "{ran}" ในระบบ · ถ้ามาครั้งแรกให้กรอกข้อมูลด้านล่างเพื่อลงทะเบียนใหม่</span>}
            {hits.map(p => {
              const lv = lastVisit.get(p.patient_id)
              return (
                <button key={p.patient_id} type="button" onClick={() => choose(p)} className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-rx-soft bg-white px-3.5 py-2.5 text-left hover:border-rx-tint-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rx-tint text-[14px] font-semibold text-rx-accent-ink">{initials(p.first_name)}</div>
                  <div className="flex min-w-0 flex-1 flex-col items-start">
                    <span className="text-[15px] font-semibold">{fullName(p.first_name, p.last_name)}</span>
                    <span className="text-[12px] text-rx-muted">HN {p.patient_id} · {stageLabel(p.current_stage)} · {ptName(p.primary_ot_name)} · มาล่าสุด {lv?.last ? thaiShort(lv.last) : '–'}</span>
                  </div>
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
              {assessButton('เปิดเคสใหม่', openNewCase)}
            </>
          ) : (
            <>
              {infoCard}

              <Card>
                <span className="text-[16px] font-semibold">ข้อมูลการรักษาครั้งนี้</span>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <RO label="ระยะอาการ (ประเมินโดยนักกายภาพ)" value={stageLabel(found.current_stage)} />
                  <RO label="ข้างที่เป็นโรค" value={found.affected_side} />
                  <Field label="น้ำหนัก (กก.)" hint="**" htmlFor="owt">
                    <input id="owt" inputMode="decimal" className={`${inputCls} border-[1.5px] border-rx-tint-2`} value={edit.weight} onChange={e => setEdit(s => ({ ...s, weight: e.target.value }))} />
                  </Field>
                  <Field label="อาการวันนี้" hint="**" htmlFor="osym" className="sm:col-span-2">
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
                {error && <span className="text-[13px] font-semibold text-[#A32D2D]">{error}</span>}
                {canCheckIn ? (
                  <Btn onClick={checkIn} disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึกและรับผู้ป่วยเข้าคิว'}</Btn>
                ) : (
                  <>
                    <Btn size="lg" onClick={saveOnly} disabled={saving} className="min-w-[200px] px-8 text-[16px]"><Save size={20} strokeWidth={2.4} />{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Btn>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      ) : ran && hits.length ? null : (
        // พบผู้ป่วยเดิมแต่ยังไม่ได้คลิกเลือก → แสดงเฉพาะรายชื่อ ไม่แสดงฟอร์มผู้ป่วยใหม่ซ้อนกัน
        <div className="flex flex-col gap-[18px]">
          <Card>
            <span className="text-[16px] font-semibold">ลงทะเบียนผู้ป่วยใหม่</span>
            <PersonFields v={form} set={setF} id="n" />
          </Card>

          {intakeCard}
          {assessButton('บันทึกการลงทะเบียน', registerNew)}
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
