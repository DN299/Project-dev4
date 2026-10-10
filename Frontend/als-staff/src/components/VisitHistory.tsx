import type { Patient, PatientAppointment, PatientProgram, SoapAmendment, TherapySession } from '../types'
import { activePrograms } from '../lib/useCase'
import { setsOfVisit, avg, effectiveSoap, thaiDate, slotLabel, apptSlot, hhmm, sameDay, ptName, initials, stageLabel, fullName } from '../lib/clinic'
import { Avatar, Badge, Chip } from './ui'

/** หัวข้อมูลผู้ป่วย (การ์ดบนสุดของหน้าเคส/ประวัติ) */
export function PatientHeader({ patient, programs, badge, extra, showPt }: { patient: Patient; programs: PatientProgram[]; badge?: React.ReactNode; extra?: React.ReactNode[]; showPt?: boolean }) {
  const prog = activePrograms(programs).map(p => p.program_name).join(', ')
  const meta = [`HN ${patient.patient_id}`, showPt && `นักกายภาพ ${ptName(patient.primary_ot_name)}`, prog && `โปรแกรม ${prog}`, ...(extra ?? [])].filter(Boolean)
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-white bg-white px-5 py-4">
      <Avatar text={initials(patient.first_name)} size={52} />
      <div className="flex flex-[1_1_260px] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[20px] font-semibold">{fullName(patient.first_name, patient.last_name)}</span>
          {badge ?? <Badge label={stageLabel(patient.current_stage)} bg="#EDEEFC" fg="#3A40C9" />}
        </div>
        <div className="flex flex-wrap gap-2 text-[12px] text-rx-muted">
          {meta.map((m, i) => <span key={i}>{i > 0 && <span className="mr-2">·</span>}{m}</span>)}
        </div>
      </div>
    </div>
  )
}

/** การ์ดการมารักษาแต่ละครั้ง */
export function VisitCard({ a, sessions, patient, variant, amendments = [] }: { a: PatientAppointment; sessions: TherapySession[]; patient: Patient; variant: 'staff' | 'therapist'; amendments?: SoapAmendment[] }) {
  // ผู้รักษาจริง = นักกายภาพที่เชื่อมต่อกระดาน · ข้อความ SOAP ใช้ฉบับปัจจุบัน (รวมบันทึกแก้ไข)
  const treater = a.treated_by_name ?? a.therapist_name
  const soap = effectiveSoap(a, amendments)
  const notes = amendments.filter(m => m.appointment_id === a.appointment_id)
  const sets = setsOfVisit(sessions, a)
  const came = a.status !== 'NO_SHOW' && a.status !== 'SCHEDULED'
  const live = a.status === 'IN_PROGRESS' || a.status === 'CHECKED_IN'
  const treaterId = a.treated_by ?? a.ot_id
  const subst = !!treaterId && !!patient.primary_ot_id && treaterId !== patient.primary_ot_id
  const total = sets.reduce((s, x) => s + x.total_reps, 0)
  const fatigue = avg(sets.map(s => s.fatigue_level).filter((f): f is number => f != null))
  const day = new Date(a.appointment_date)
  const isToday = sameDay(day, new Date())

  const setChips = sets.map((s, i) => <Chip key={s.session_id}>เซต {i + 1}: ทำได้ {s.total_reps} ครั้ง</Chip>)

  if (variant === 'therapist') {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-white bg-white px-[18px] py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[15px] font-semibold">{thaiDate(day)}</span>
            <span className="text-[13px] text-rx-muted">ผู้รักษา {ptName(treater)}</span>
            {subst && <Badge label="รักษาแทน" />}
          </div>
          {!came ? <Badge label="ไม่มาตามนัด" bg="#FCEBEB" fg="#791F1F" />
            : live ? <Badge label="กำลังรักษา · ร่าง" bg="#E3EEF9" fg="#1F5573" />
            : a.soap_saved_at ? <Badge label={`บันทึกผลแล้ว ${hhmm(new Date(a.soap_saved_at))}`} bg="#E4F5EC" fg="#145C38" />
            : <Badge label="ยังไม่บันทึกผล" />}
        </div>
        {live && <span className="text-[14px] text-rx-muted">กำลังฝึก · จะบันทึกผลเมื่อจบการฝึก</span>}
        {came && (soap.A || soap.P) && (
          <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[14px] leading-relaxed">
            {soap.A && <><span className="font-semibold text-rx-muted">A</span><span>{soap.A}</span></>}
            {soap.P && <><span className="font-semibold text-rx-muted">P</span><span>{soap.P}</span></>}
          </div>
        )}
        {came && (
          <div className="flex flex-wrap gap-1.5">
            {live && <Chip>ช่อง {slotLabel(apptSlot(a))}</Chip>}
            {live && a.device_name && <Chip>กระดาน {a.device_name}</Chip>}
            {setChips}
            {fatigue != null && <Chip>เหนื่อย {fatigue.toFixed(fatigue % 1 ? 1 : 0)}/5</Chip>}
          </div>
        )}
        {notes.map(m => (
          <div key={m.amendment_id} className="rounded-lg bg-rx-bg px-3.5 py-2 text-[12px] leading-relaxed text-rx-muted">
            บันทึกแก้ไขเพิ่มเติม · {ptName(m.amended_by_name)} {thaiDate(new Date(m.amended_at))} {hhmm(new Date(m.amended_at))} — แก้ {m.field} จาก "{m.old_value || '–'}" เป็น "{m.new_value || '–'}" เหตุผล: {m.reason} ฉบับเดิมยังเก็บไว้
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-white bg-white px-[18px] py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[15px] font-semibold">{thaiDate(day)}{isToday ? ' · วันนี้' : ''}</span>
          <span className="text-[13px] text-rx-muted">ช่อง {slotLabel(apptSlot(a))}</span>
        </div>
        {came ? <Badge label={live ? 'กำลังรักษา' : 'มารักษา'} bg={live ? '#E3EEF9' : '#E4F5EC'} fg={live ? '#1F5573' : '#145C38'} /> : <Badge label="ไม่มาตามนัด" bg="#FCEBEB" fg="#791F1F" />}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-rx-tint px-3.5 py-2.5">
        <Avatar text={initials(treater)} size={36} solid />
        <div className="flex flex-col">
          <span className="text-[12px] text-rx-accent-deep">ผู้รักษาในครั้งนี้</span>
          <span className="text-[16px] font-semibold">{ptName(treater)}</span>
        </div>
        {subst && <Badge label="รักษาแทนนักกายภาพประจำเคส" bg="#FFF0D9" fg="#8C420A" />}
      </div>
      {came && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-lg bg-rx-bg px-2.5 py-[3px] text-[12px] font-semibold">รวม {total} ครั้ง</span>
            {setChips}
            {fatigue != null && <Chip>ความเหนื่อยระดับ {fatigue.toFixed(fatigue % 1 ? 1 : 0)}</Chip>}
            {a.weight_kg != null && <Chip>น้ำหนัก {a.weight_kg} กก.</Chip>}
          </div>
          {(a.symptoms_today || soap.A || soap.P) && (
            <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 text-[14px] leading-relaxed">
              {a.symptoms_today && <><span className="text-rx-muted">ฟีดแบ็ก</span><span>"{a.symptoms_today}"</span></>}
              {soap.A && <><span className="text-rx-muted">ผลการรักษา</span><span>{soap.A}</span></>}
              {soap.P && <><span className="text-rx-muted">คำแนะนำ</span><span>{soap.P}</span></>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
