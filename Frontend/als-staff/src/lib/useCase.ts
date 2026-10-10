import { useEffect, useState } from 'react'
import type { Patient, PatientAppointment, PatientProgram, SoapAmendment, TherapySession } from '../types'
import { api, list, isTraining } from './clinic'

export interface CaseData {
  patient: Patient | null
  appts: PatientAppointment[]
  sessions: TherapySession[]
  programs: PatientProgram[]
  amendments: SoapAmendment[]
  reload: () => Promise<void>
  loading: boolean
}

/** โหลดข้อมูลทั้งเคสของผู้ป่วย: ข้อมูลผู้ป่วย นัดทั้งหมด เซตการฝึก และโปรแกรม */
export function useCase(patientId: string): CaseData {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [appts, setAppts] = useState<PatientAppointment[]>([])
  const [sessions, setSessions] = useState<TherapySession[]>([])
  const [programs, setPrograms] = useState<PatientProgram[]>([])
  const [amendments, setAmendments] = useState<SoapAmendment[]>([])
  const [loading, setLoading] = useState(true)

  const reload = () => Promise.all([
    api<Patient[]>(`/api/patients?patient_id=${patientId}`).then(r => setPatient(r[0] ?? null)).catch(() => setPatient(null)),
    list<PatientAppointment>(`/api/appointments?patient_id=${patientId}`).then(setAppts),
    list<TherapySession>(`/api/sessions?patient_id=${patientId}`).then(setSessions),
    list<PatientProgram>(`/api/patient-programs?patient_id=${patientId}`).then(setPrograms),
    list<SoapAmendment>(`/api/soap-amendments?patient_id=${patientId}`).then(setAmendments),
  ]).then(() => undefined).finally(() => setLoading(false))

  useEffect(() => { setLoading(true); reload() }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps
  return { patient, appts, sessions, programs, amendments, reload, loading }
}

export const activePrograms = (programs: PatientProgram[]) => programs.filter(p => p.status === 'ACTIVE')

/** นัดฝึกที่ผ่านมาแล้ว (มา/ไม่มา/กำลังรักษา) เรียงล่าสุดก่อน */
export function pastVisits(appts: PatientAppointment[], today = new Date()) {
  return appts
    .filter(a => isTraining(a) && (['COMPLETED', 'NO_SHOW', 'IN_PROGRESS', 'CHECKED_IN'].includes(a.status) || (a.status === 'SCHEDULED' && new Date(a.appointment_date) < new Date(today.getFullYear(), today.getMonth(), today.getDate()))))
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))
}
