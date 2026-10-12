-- ขั้นตอนรายคน: นักกายภาพบันทึกผล (COMPLETED) → เวชระเบียนอ่านผล / ลงนัดต่อ แล้วปิดงาน (records_done_at) → เรียกคิวถัดไปได้
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "records_done_at" timestamp;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "records_done_by" varchar(10) REFERENCES "users"("users_id") ON UPDATE CASCADE ON DELETE SET NULL;--> statement-breakpoint
-- นัดที่จบไปก่อนมีขั้นตอนนี้ ถือว่าเวชระเบียนปิดงานแล้ว (ไม่ให้ค้างขวางการเรียกคิว)
UPDATE "appointments" SET "records_done_at" = coalesce("completed_at", now() at time zone 'utc') WHERE "status" = 'COMPLETED' AND "records_done_at" IS NULL;
