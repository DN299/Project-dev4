-- คำนำหน้าชื่อ และที่อยู่แยกช่อง (แขวง/ตำบล · อำเภอ/เขต · จังหวัด) — patients.address เก็บบ้านเลขที่ หมู่ ถนน
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "title_name" varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "subdistrict" varchar(100);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "district" varchar(100);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "province" varchar(100);
