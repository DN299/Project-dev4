-- เทเลเมทรีของอุปกรณ์ skateboard rehab สำหรับการ์ดสถานะอุปกรณ์บนแดชบอร์ด
-- ทั้งหมด additive/nullable-with-default จึงไม่กระทบอุปกรณ์ที่มีอยู่เดิม
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "connection_status" varchar(20) NOT NULL DEFAULT 'DISCONNECTED';--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "battery_level" integer;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "imu_status" varchar(20) NOT NULL DEFAULT 'UNKNOWN';--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "encoder_status" varchar(20) NOT NULL DEFAULT 'UNKNOWN';--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp;
