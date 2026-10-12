// ความยาวช่องนัด (นาที) — ช่องละ 1 ชั่วโมง ใช้ร่วมกับ SLOT_MIN ฝั่งหน้าเว็บ (Frontend/als-staff/src/lib/clinic.ts)
// appointments.slot (generated) = appointment_date + duration_min ใช้กันนัดชนในฐานข้อมูล
export const SLOT_MIN = 60
// เวลาเริ่มของแต่ละช่อง (เวลาไทย) — เปิด 09:00–16:00 พักกลางวัน 12:00–13:00 · ตรงกับ SLOT_STARTS ฝั่งหน้าเว็บ
export const SLOT_STARTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00']
