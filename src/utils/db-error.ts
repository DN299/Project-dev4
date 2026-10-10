// drizzle-orm wraps the real postgres error inside DrizzleQueryError.cause —
// error.code on the caught error is always undefined, the real Postgres error code lives at error.cause.code
export function pgErrorCode(error: any): string | undefined {
  return error?.code ?? error?.cause?.code
}

// กฎที่ฐานข้อมูลบังคับเอง (exclusion constraint / unique index) → ข้อความที่ผู้ใช้อ่านเข้าใจ
const CONSTRAINT_MESSAGE: Record<string, string> = {
  no_device_overlap: 'ช่องเวลานี้มีนัดใช้กระดานแล้ว กรุณาเลือกช่องอื่น',
  no_ot_overlap: 'นักกายภาพติดนัดอื่นในช่องเวลานี้แล้ว',
  one_appt_per_patient_per_day: 'ผู้ป่วยมีนัดในวันนั้นแล้ว (นัดได้วันละครั้ง)',
  one_in_progress_per_device: 'กระดานกำลังมีผู้ป่วยฝึกอยู่ ต้องจบการฝึกของคนปัจจุบันก่อน',
  one_open_case_per_patient: 'ผู้ป่วยมีเคสที่ยังไม่ปิดอยู่แล้ว',
  one_row_per_set: 'บันทึกเซตนี้ไปแล้ว',
  appointments_training_needs_device: 'นัดฝึกต้องผูกกับกระดาน',
}

/** แปลงข้อผิดพลาดจากฐานข้อมูลเป็น { status, error } สำหรับตอบกลับ API */
export function dbError(error: any): { status: number; error: string } {
  const code = pgErrorCode(error)
  const constraint: string | undefined = error?.cause?.constraint_name ?? error?.constraint_name
  if (constraint && CONSTRAINT_MESSAGE[constraint]) return { status: 409, error: CONSTRAINT_MESSAGE[constraint] }
  // raise exception จาก trigger (appt_status_guard, lock_saved_soap, session_guard) — ข้อความเป็นภาษาไทยอยู่แล้ว
  if (code === 'P0001') return { status: 409, error: error?.cause?.message ?? error.message }
  if (code === '23505') return { status: 409, error: 'ข้อมูลนี้ซ้ำกับที่มีอยู่ในระบบแล้ว (เช่น เบอร์โทรหรืออีเมล)' }
  return { status: 500, error: error?.message ?? 'เกิดข้อผิดพลาด' }
}
