-- ส่งแจ้งเตือนนัดให้ผู้ป่วยแล้วหรือยัง — คอลัมน์นี้ถูกเพิ่มในฐานข้อมูลจริงแล้ว ไฟล์นี้บันทึกไว้ให้สร้างซ้ำได้
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder_sent" boolean NOT NULL DEFAULT false;
