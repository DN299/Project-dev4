-- ติดตามขั้นตอนการลงทะเบียนของผู้ป่วยแต่ละคน (สำหรับหน้าคิว)
-- default เป็นขั้นที่ 4 / COMPLETED เพื่อไม่กระทบผู้ป่วยเดิมที่ลงทะเบียนครบก่อนมีคอลัมน์นี้
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "registration_step" integer NOT NULL DEFAULT 4;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "status" varchar(20) NOT NULL DEFAULT 'COMPLETED';--> statement-breakpoint

-- sequence สำหรับออกรหัสผู้ป่วย/ผู้ใช้/นัดหมายแบบเรียงลำดับ (ไม่สุ่ม)
CREATE SEQUENCE IF NOT EXISTS "users_id_seq";--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "patient_id_seq";--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "appointment_id_seq";
