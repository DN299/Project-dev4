-- ระบบคิวแบบช่องเวลา 20 นาที + ประเมินแรกรับ + บันทึก SOAP + ความเหนื่อยหลังเซต + ปิดเคส
-- ทั้งหมด additive/nullable จึงไม่กระทบข้อมูลเดิม

-- นัดหมาย: ประเภทนัด (ฝึกกับกระดาน / ประเมินแรกรับ) และสถานะคิวระหว่างวัน
-- status: SCHEDULED → CHECKED_IN (รับคิวแล้ว) → IN_PROGRESS (กำลังฝึก) → COMPLETED / NO_SHOW / CANCELLED
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "appointment_type" varchar(20) NOT NULL DEFAULT 'TRAINING';--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "checked_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "checked_in_by" varchar(10) REFERENCES "users"("users_id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "symptoms_today" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "weight_kg" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "soap_s" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "soap_o" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "soap_a" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "soap_p" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "soap_saved_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "duration_min" SET DEFAULT 20;--> statement-breakpoint

-- ผลการฝึกแต่ละเซต: ความเหนื่อยที่ผู้ป่วยให้ (1–5) และนัดที่เซตนี้เกิดขึ้น
ALTER TABLE "therapy_sessions" ADD COLUMN IF NOT EXISTS "fatigue_level" integer;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD COLUMN IF NOT EXISTS "appointment_id" varchar(10) REFERENCES "appointments"("appointment_id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint

-- ผู้ป่วย: ซักประวัติเบื้องต้นจากเวชระเบียน
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "chief_complaint" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "pain_level" integer;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "symptom_location" varchar(255);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "onset_duration" varchar(50);--> statement-breakpoint
-- ผู้ดูแล
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "caretaker_relation" varchar(50);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "caretaker_can_use_app" boolean;--> statement-breakpoint
-- นักกายภาพประจำเคส + ผลประเมินแรกรับ
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "primary_ot_id" varchar(10) REFERENCES "occupational_therapists"("ot_id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "assessment_note" text;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "assessed_at" timestamp;--> statement-breakpoint
-- ปิดเคส (เสร็จสิ้นการรักษา)
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "case_status" varchar(20) NOT NULL DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "start_stage" varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "case_closed_at" timestamp;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "close_reason" varchar(100);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "close_stage" varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "close_summary" text;--> statement-breakpoint

-- ระยะอาการเปลี่ยนเป็นระยะของ ALS: ระยะแรก / ระยะกลาง / ระยะท้าย
UPDATE "programs" SET "target_stage" = CASE "target_stage" WHEN 'FLACCID' THEN 'EARLY' WHEN 'SPASTIC' THEN 'MIDDLE' WHEN 'RECOVERY' THEN 'LATE' ELSE "target_stage" END;--> statement-breakpoint
UPDATE "patients" SET "current_stage" = CASE "current_stage" WHEN 'FLACCID' THEN 'EARLY' WHEN 'SPASTIC' THEN 'MIDDLE' WHEN 'RECOVERY' THEN 'LATE' ELSE "current_stage" END;--> statement-breakpoint

-- ผู้ป่วยเดิม: ใช้นักกายภาพจากนัดล่าสุดเป็นนักกายภาพประจำเคส
UPDATE "patients" p SET "primary_ot_id" = a."ot_id"
FROM (SELECT DISTINCT ON ("patient_id") "patient_id", "ot_id" FROM "appointments" WHERE "ot_id" IS NOT NULL ORDER BY "patient_id", "appointment_date" DESC) a
WHERE p."patient_id" = a."patient_id" AND p."primary_ot_id" IS NULL;--> statement-breakpoint

CREATE SEQUENCE IF NOT EXISTS "therapy_session_id_seq";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_date_idx" ON "appointments" ("appointment_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "therapy_sessions_appointment_idx" ON "therapy_sessions" ("appointment_id");
--> statement-breakpoint
-- รหัสโปรแกรมของผู้ป่วยแบบเรียงลำดับ (PPG000001) — ขึ้นต้น PPG จึงไม่ชนกับรหัสเดิมแบบ PP+ตัวเลข
CREATE SEQUENCE IF NOT EXISTS "patient_program_id_seq";
