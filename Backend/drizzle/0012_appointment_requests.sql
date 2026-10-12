-- F1.5 คำขอนัด: นักกายภาพระบุช่วงเวลาที่ต้องการให้นัด (เช่น "อีก 1 สัปดาห์") → เวชระเบียนเลือกวันและช่องที่ว่างในช่วงนั้นแล้วบันทึกนัดจริง
-- ตารางนี้มีอยู่แล้วในฐานข้อมูลจริง ไฟล์นี้บันทึกโครงสร้างไว้ให้สร้างซ้ำได้ (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "appointment_requests" (
  "request_id"     varchar PRIMARY KEY,
  "patient_id"     varchar NOT NULL REFERENCES "patients"("patient_id") ON UPDATE CASCADE ON DELETE CASCADE,
  "case_id"        varchar REFERENCES "treatment_cases"("case_id"),
  "ot_id"          varchar REFERENCES "occupational_therapists"("ot_id") ON UPDATE CASCADE ON DELETE SET NULL,
  "requested_by"   varchar REFERENCES "users"("users_id") ON UPDATE CASCADE ON DELETE SET NULL,
  "window_label"   varchar,
  "earliest_date"  date NOT NULL,
  "latest_date"    date NOT NULL,
  "note"           varchar,
  "status"         varchar NOT NULL DEFAULT 'PENDING',
  "appointment_id" varchar REFERENCES "appointments"("appointment_id") ON UPDATE CASCADE ON DELETE SET NULL,
  "booked_by"      varchar REFERENCES "users"("users_id") ON UPDATE CASCADE ON DELETE SET NULL,
  "booked_at"      timestamp,
  "created_at"     timestamp NOT NULL DEFAULT (now() at time zone 'utc'),
  CONSTRAINT "appointment_requests_window_chk" CHECK ("latest_date" >= "earliest_date")
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "one_pending_request_per_case" ON "appointment_requests" ("case_id") WHERE "status" = 'PENDING';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_requests_status_idx" ON "appointment_requests" ("status");--> statement-breakpoint
-- index ซ้ำซ้อนที่เผลอสร้างไว้ (one_pending_request_per_case ครอบคลุมแล้ว)
DROP INDEX IF EXISTS "one_pending_request_per_patient";
