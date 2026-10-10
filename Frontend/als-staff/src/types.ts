export type PageKey =
  // เวชระเบียน
  | 'dashboard' | 'register' | 'queue' | 'rec-patient' | 'status' | 'schedule' | 'programs'
  // นักกายภาพ
  | 'my-home' | 'my-cases' | 'case' | 'assess' | 'my-schedule'
  // ผู้ป่วย
  | 'patient-home' | 'patient-queue' | 'patient-appointments' | 'patient-stats' | 'patient-feedback' | 'patient-profile'
  | 'patient-train' | 'patient-summary'

/** ระยะอาการของ ALS: ระยะแรก / ระยะกลาง / ระยะท้าย */
export type DiseaseStage = 'EARLY' | 'MIDDLE' | 'LATE'

export interface AuthUser {
  users_id: string; username: string; first_name: string; last_name: string
  role_id: string; role_name: string; ot_id?: string | null; patient_id?: string | null
}

export interface Therapist {
  ot_id: string; users_id?: string; license_number: string
  first_name: string; last_name: string; phone?: string; cases?: number
}

export interface Staff {
  staff_id: string; users_id: string
  first_name: string; last_name: string; phone?: string | null; email?: string | null
}

/** ผู้ป่วย + ข้อมูลของเคสปัจจุบัน (เคสที่ยังไม่ปิด หรือเคสที่ปิดล่าสุด) */
export interface Patient {
  patient_id: string; users_id: string
  /** น้ำหนักที่บันทึกตอนรับเข้าคิวครั้งล่าสุด */
  weight?: number | string | null; register_date?: string | null; address?: string | null
  affected_side?: string | null
  first_name?: string | null; last_name?: string | null; phone?: string | null
  email?: string | null; birth_date?: string | null; gender?: string | null
  caretaker_name?: string | null; caretaker_phone?: string | null
  caretaker_relation?: string | null; caretaker_can_use_app?: boolean | null
  chief_complaint?: string | null; pain_level?: number | null
  symptom_location?: string | null; onset_duration?: string | null
  current_stage?: DiseaseStage | null
  primary_ot_id?: string | null; primary_ot_name?: string | null; primary_ot_lastname?: string | null
  assessment_note?: string | null; assessed_at?: string | null
  case_id?: string | null; case_count?: number
  case_status?: 'PENDING_ASSESSMENT' | 'ACTIVE' | 'CLOSED' | null
  start_stage?: DiseaseStage | null; case_opened_at?: string | null; case_closed_at?: string | null
  close_reason?: string | null; close_stage?: DiseaseStage | null; close_summary?: string | null
}

export interface Device {
  device_id: string; device_name: string; serial_number: string; status: string
  connection_status?: 'CONNECTED' | 'DISCONNECTED' | string
  battery_level?: number | null
  imu_status?: 'OK' | 'WARNING' | 'ERROR' | 'UNKNOWN' | string
  encoder_status?: 'OK' | 'WARNING' | 'ERROR' | 'UNKNOWN' | string
  last_seen_at?: string | null
  /** ค่าสดจากอุปกรณ์ (POST /api/devices/telemetry) */
  live_status?: 'IDLE' | 'RUNNING' | string
  live_reps?: number | null
  voltage?: number | null
  current_a?: number | null
  /** นัดที่กระดานผูกอยู่ตอนนี้ (นัดที่กำลังฝึก) */
  current_appointment_id?: string | null
  holder_patient_id?: string | null; holder_name?: string | null; issued_date?: string | null
}

export type AppointmentStatus = 'SCHEDULED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'

/** นัดหมายที่เก็บจริงในฐานข้อมูล (ตาราง appointments) */
export interface PatientAppointment {
  appointment_id: string
  patient_id: string
  case_id?: string | null
  patient_name?: string | null
  patient_lastname?: string | null
  ot_id?: string | null
  therapist_name?: string | null
  therapist_lastname?: string | null
  /** นักกายภาพที่เชื่อมต่อกระดานจริง (ผู้รักษาจริง) */
  treated_by?: string | null
  treated_by_name?: string | null
  created_by?: string | null
  primary_ot_id?: string | null
  device_id?: string | null
  device_name?: string | null
  device_status?: string | null
  appointment_date: string
  duration_min: number
  appointment_type: 'TRAINING' | 'ASSESSMENT' | string
  treated_side?: string | null
  affected_side?: string | null
  current_stage?: DiseaseStage | null
  status: AppointmentStatus | string
  note?: string | null
  checked_in_at?: string | null
  checked_in_by_name?: string | null
  /** เวชระเบียนเรียกคิวแล้ว รอนักกายภาพเชื่อมต่อกระดาน */
  called_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  symptoms_today?: string | null
  weight_kg?: number | null
  soap_s?: string | null
  soap_o?: string | null
  soap_a?: string | null
  soap_p?: string | null
  soap_saved_at?: string | null
}

/** ประวัติการฝึกจริง (ตาราง therapy_sessions) */
export interface TherapySession {
  session_id: string
  session_date: string
  duration_sec: number
  total_reps: number
  status: string
  set_number?: number
  fatigue_level?: number | null
  patient_comment?: string | null
  appointment_id?: string | null
  program_id: string
  program_name: string
  patient_id?: string
  movement_count: string | null
}

/** โปรแกรมการฝึก (ตาราง programs) */
export interface Program {
  program_id: string
  program_name: string
  description?: string | null
  program_type: string
  target_stage?: DiseaseStage | null
  session_per_day: number
  duration_sec: number
  created_by?: string | null
  status: string
  patient_count?: number
}

/** โปรแกรมที่มอบหมายให้ผู้ป่วยแล้ว (ตาราง patient_programs join programs) */
export interface PatientProgram {
  patient_program_id: string
  patient_id: string
  case_id?: string | null
  program_id: string
  program_name: string
  description?: string | null
  target_stage?: DiseaseStage | null
  session_per_day: number
  duration_sec: number
  assigned_date: string
  status: string
}

/** บันทึกแก้ไขหลังบันทึกผลแล้ว (ตาราง soap_amendments) — ฉบับเดิมยังอยู่ใน appointments */
export interface SoapAmendment {
  amendment_id: string
  appointment_id: string
  field: 'S' | 'O' | 'A' | 'P' | 'REPS'
  old_value: string | null
  new_value: string | null
  reason: string | null
  amended_by: string
  amended_by_name?: string | null
  amended_at: string
}

/** คำแนะนำจากนักกายภาพ (ส่วน P ของบันทึก SOAP ที่บันทึกผลแล้ว) */
export interface SessionFeedback {
  feedback_id: string
  comment: string | null
  rating: number | null
  created_at: string
  session_id: string
  session_date: string
  therapist_name?: string | null
  therapist_lastname?: string | null
}
