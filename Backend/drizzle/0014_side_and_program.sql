-- ประเมินข้างที่รักษา (ซ้าย / ขวา / ทั้งสองข้าง) และโปรแกรมของครั้งนี้กับครั้งหน้า
-- appointments.treated_side มีอยู่แล้ว: 'ข้างซ้าย' | 'ข้างขวา' | 'ทั้งสองข้าง'
-- appointments.current_side: ข้างของเซตที่กำลังฝึก (LEFT/RIGHT) — กระดานไม่รู้ว่าฝึกข้างไหน นักกายภาพเป็นคนเลือก
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "current_side" varchar(10);--> statement-breakpoint
-- โปรแกรมที่ใช้ครั้งนี้ (เซตที่บันทึกจากกระดานผูกกับโปรแกรมนี้) และโปรแกรมที่วางแผนให้ครั้งหน้า
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "patient_program_id" varchar(10) REFERENCES "patient_programs"("patient_program_id") ON UPDATE CASCADE ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "next_program_id" varchar(10) REFERENCES "programs"("program_id") ON UPDATE CASCADE ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_current_side_chk";--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_current_side_chk" CHECK ("current_side" IS NULL OR "current_side" IN ('LEFT', 'RIGHT'));--> statement-breakpoint
-- ข้างของแต่ละเซต — ผู้ป่วยที่เป็นทั้งสองข้างประเมินผลแยกข้าง
ALTER TABLE "therapy_sessions" ADD COLUMN IF NOT EXISTS "side" varchar(10);--> statement-breakpoint
ALTER TABLE "therapy_sessions" DROP CONSTRAINT IF EXISTS "therapy_sessions_side_chk";--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_side_chk" CHECK ("side" IS NULL OR "side" IN ('LEFT', 'RIGHT'));
