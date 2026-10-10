import { useEffect, useState } from 'react'
import type { AuthUser, DiseaseStage, Patient, PatientAppointment, Program } from '../../types'
import {
  api, list, rangeQuery, SLOTS, slotDate, slotLabel, apptSlot, addDays, startOfDay, thaiDate, hhmm, isClosedDay, trainingAt,
  STAGES, STAGE_LABEL, ageFrom, initials, fullName,
} from '../../lib/clinic'
import { Avatar, BackLink, Badge, Btn, DayPicker, ErrorText, Field, Loading, SlotGrid, selectCls, textareaCls } from '../../components/ui'

interface Props { user: AuthUser; appointmentId: string; onBack: () => void; onDone: (patientId: string) => void }

const SIDES = ['ข้างซ้าย', 'ข้างขวา', 'ทั้งสองข้าง']

export default function AssessPage({ user, appointmentId, onBack, onDone }: Props) {
  const today = startOfDay(new Date())
  const [appt, setAppt] = useState<PatientAppointment | null>(null)
  const [patient, setPatient] = useState<Patient | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [center, setCenter] = useState<PatientAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [stage, setStage] = useState<DiseaseStage | ''>('')
  const [side, setSide] = useState(SIDES[0])
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [day, setDay] = useState<Date | null>(null)
  const [slot, setSlot] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      list<PatientAppointment>(`/api/appointments?ot_id=${user.ot_id}&${rangeQuery(addDays(today, -1), addDays(today, 2))}`),
      list<Program>(`/api/programs?created_by=${user.users_id}`),
      list<PatientAppointment>(`/api/appointments?${rangeQuery(addDays(today, 1), addDays(today, 15))}`),
    ]).then(async ([mine, progs, c]) => {
      const a = mine.find(x => x.appointment_id === appointmentId) ?? null
      setAppt(a); setPrograms(progs.filter(p => p.status === 'ACTIVE')); setCenter(c)
      if (a) {
        const [p] = await api<Patient[]>(`/api/patients?patient_id=${a.patient_id}`)
        setPatient(p ?? null)
        if (p?.affected_side && SIDES.includes(p.affected_side)) setSide(p.affected_side)
      }
    }).finally(() => setLoading(false))
  }, [appointmentId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Loading />
  if (!appt || !patient) return <><BackLink onClick={onBack}>หน้าแรก</BackLink><Loading text="ไม่พบนัดประเมินนี้" /></>

  const days: Date[] = []
  for (let o = 1; days.length < 6 && o < 15; o++) { const d = addDays(today, o); if (!isClosedDay(d)) days.push(d) }
  const freeCount = (d: Date) => SLOTS.filter(x => !trainingAt(center, d, x.s)).length
  const selDay = day ?? days.find(d => freeCount(d) > 0) ?? days[0]
  const slots = SLOTS.map(x => ({ s: x.s, label: slotLabel(x.s), free: !trainingAt(center, selDay, x.s), meta: trainingAt(center, selDay, x.s) ? 'มีนัดแล้ว' : 'ว่าง' }))
  const missing = !stage ? 'ระบุระยะอาการก่อน' : !picked.length ? 'เลือกโปรแกรมอย่างน้อย 1 รายการ' : !slot ? 'เลือกช่องเวลานัด' : ''
  const age = ageFrom(patient.birth_date)
  const name = fullName(patient.first_name, patient.last_name)

  const save = async () => {
    if (missing || !stage) return
    setSaving(true); setError('')
    try {
      await api('/api/patients', {
        method: 'PATCH',
        body: {
          action: 'ASSESS', patientId: patient.patient_id, otId: user.ot_id, usersId: user.users_id, stage, affectedSide: side, assessmentNote: note,
          programIds: picked, assessmentAppointmentId: appt.appointment_id, nextAppointmentDate: slotDate(selDay, slot).toISOString(),
        },
      })
      onDone(patient.patient_id)
    } catch (e) { setError((e as Error).message); setSaving(false) }
  }

  const info: [string, React.ReactNode][] = [
    ['อาการที่มาพบ', patient.chief_complaint || appt.symptoms_today || '—'],
    ['ระดับความเจ็บปวด', patient.pain_level != null ? <><span className="font-semibold">{patient.pain_level}</span> <span className="text-rx-muted">(สเกล 0–10)</span></> : '—'],
    ['ตำแหน่งที่มีอาการ', patient.symptom_location || '—'],
    ['เริ่มมีอาการ', patient.onset_duration || '—'],
    ['ข้อมูลทั่วไป', [
      patient.weight ? `น้ำหนัก ${Number(patient.weight)} กก.` : '',
      patient.caretaker_name ? `ผู้ดูแล ${patient.caretaker_name}${patient.caretaker_relation ? ` (${patient.caretaker_relation})` : ''}${patient.caretaker_phone ? ` ${patient.caretaker_phone}` : ''}` : '',
    ].filter(Boolean).join(' · ') || '—'],
  ]

  return (
    <>
      <BackLink onClick={onBack}>หน้าแรก</BackLink>
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-white px-6 py-5">
        <Avatar text={initials(patient.first_name)} size={56} />
        <div className="flex flex-[1_1_320px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[26px] font-semibold">{name}</span>
            <Badge label="ประเมินแรกรับ" bg="#FFF0D9" fg="#8C420A" />
          </div>
          <span className="text-[14px] text-rx-muted">
            HN {patient.patient_id}{patient.gender ? ` · ${patient.gender}` : ''}{age != null ? ` อายุ ${age} ปี` : ''} · นัดประเมิน{apptSlot(appt) && ` ${slotLabel(apptSlot(appt))} น.`}
            {appt.checked_in_at ? ` · ส่งจากเวชระเบียน${appt.checked_in_by_name ? ` (${appt.checked_in_by_name})` : ''} ${hhmm(new Date(appt.checked_in_at))} น.` : ''}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5 rounded-lg bg-white px-6 py-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[18px] font-semibold">ข้อมูลซักประวัติจากเวชระเบียน</span>
            <span className="text-[13px] text-rx-muted">บันทึกตามที่ผู้ป่วยเล่า ใช้ประกอบการประเมิน</span>
          </div>
          <div className="flex flex-col">
            {info.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[150px_minmax(0,1fr)] gap-2.5 border-t border-rx-divider py-2.5 text-[14px] leading-relaxed">
                <span className="text-rx-muted">{k}</span><span>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5 rounded-lg bg-white px-6 py-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[18px] font-semibold">ผลการประเมิน</span>
            <span className="text-[13px] text-rx-muted">นักกายภาพเป็นคนระบุระยะของโรค</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">ระยะอาการ</span>
            <div className="grid grid-cols-3 gap-2">
              {STAGES.map(s => (
                <button key={s} type="button" onClick={() => setStage(s)} className={`h-12 rounded-lg text-[14px] font-semibold ${stage === s ? 'border-[1.5px] border-rx-accent bg-rx-accent text-white' : 'border border-rx-line bg-white text-rx-ink'}`}>{STAGE_LABEL[s]}</button>
              ))}
            </div>
          </div>
          <Field label="ข้างที่เป็นโรค" htmlFor="side" className="max-w-[260px]">
            <select id="side" className={selectCls} value={side} onChange={e => setSide(e.target.value)}>{SIDES.map(s => <option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="บันทึกการประเมิน" htmlFor="note">
            <textarea id="note" rows={3} className={textareaCls} placeholder="ผลตรวจกำลังกล้ามเนื้อ ช่วงการเคลื่อนไหว ข้อควรระวัง" value={note} onChange={e => setNote(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-lg bg-white px-6 py-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[18px] font-semibold">เลือกโปรแกรมฝึก</span>
          <span className="text-[13px] text-rx-muted">{stage ? `โปรแกรมจากคลัง · มีป้ายกำกับอันที่เหมาะกับ${STAGE_LABEL[stage]}` : 'โปรแกรมจากคลัง · เลือกได้มากกว่า 1 รายการ'}</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          {programs.map(p => {
            const on = picked.includes(p.program_id)
            return (
              <button
                key={p.program_id}
                type="button"
                onClick={() => setPicked(on ? picked.filter(x => x !== p.program_id) : [...picked, p.program_id])}
                className={`flex flex-col items-start gap-2 rounded-lg px-4 py-3.5 text-left ${on ? 'border-[1.5px] border-rx-accent bg-[#F6F6FE]' : 'border border-rx-line bg-white'}`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="text-[15px] font-semibold">{p.program_name}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-[3px] text-[12px] font-semibold ${on ? 'bg-rx-accent text-white' : 'bg-rx-bg text-rx-muted'}`}>{on ? '✓ เลือกแล้ว' : 'เลือก'}</span>
                </div>
                {p.description && <span className="text-[13px] leading-normal text-rx-muted">{p.description}</span>}
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-rx-bg px-2 py-0.5 text-[12px]">{p.session_per_day} เซต · {Math.round(p.duration_sec / 60)} นาที · จำนวนครั้งตามกำลัง</span>
                  {stage && p.target_stage === stage && <span className="rounded-md bg-[#EAF7E3] px-2 py-0.5 text-[12px] font-semibold text-[#2E8A0B]">แนะนำสำหรับระยะที่เลือก</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-lg bg-white px-6 py-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[18px] font-semibold">ลงนัดกายภาพครั้งถัดไป</span>
          <span className="text-[13px] text-rx-muted">เลือกวัน แล้วเลือกช่องเวลาที่กระดานยังว่าง</span>
        </div>
        <DayPicker days={days} selected={selDay} onPick={d => { setDay(d); setSlot('') }} meta={d => (freeCount(d) ? `ว่าง ${freeCount(d)} ช่อง` : 'เต็ม')} />
        <SlotGrid slots={slots} selected={slot} onPick={setSlot} min={130} />
      </div>

      <ErrorText>{error}</ErrorText>
      <div className="flex flex-wrap items-center gap-4 rounded-lg border-[1.5px] border-rx-tint-2 bg-white px-6 py-[18px]">
        <div className="grid flex-[1_1_360px] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
          <div className="flex flex-col"><span className="text-[12px] text-rx-muted">ระยะอาการ</span><span className="text-[15px] font-semibold">{stage ? STAGE_LABEL[stage] : '–'}</span></div>
          <div className="flex flex-col"><span className="text-[12px] text-rx-muted">โปรแกรม</span><span className="text-[15px] font-semibold">{picked.length ? programs.filter(p => picked.includes(p.program_id)).map(p => p.program_name).join(', ') : '–'}</span></div>
          <div className="flex flex-col"><span className="text-[12px] text-rx-muted">นัดครั้งถัดไป</span><span className="text-[15px] font-semibold">{slot ? `${thaiDate(selDay)} · ${slotLabel(slot)}` : '–'}</span></div>
        </div>
        {missing ? <Btn size="lg" disabled>{missing}</Btn> : <Btn size="lg" disabled={saving} onClick={save}>{saving ? 'กำลังบันทึก...' : 'บันทึกผลประเมินและยืนยันนัด'}</Btn>}
      </div>
    </>
  )
}
