-- ค่าสดจากอุปกรณ์ระหว่างฝึก + ค่าไฟจากแหล่งจ่าย + ช่องทางสั่งงานอุปกรณ์จากแอปผู้ป่วย
-- ทั้งหมด additive/nullable จึงไม่กระทบอุปกรณ์ที่มีอยู่เดิม
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "live_status" varchar(20) NOT NULL DEFAULT 'IDLE';--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "live_reps" integer;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "voltage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "current_a" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "pending_command" varchar(20);
