-- เพิ่มข้างที่รักษา + บริเวณที่ได้รับผลกระทบ ให้ตาราง patients
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "affected_side" varchar(20);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "affected_areas" varchar(255);--> statement-breakpoint

-- ตารางนัดหมายของผู้ป่วยแต่ละคน
CREATE TABLE IF NOT EXISTS "appointments" (
	"appointment_id" varchar(10) PRIMARY KEY NOT NULL,
	"patient_id" varchar(10) NOT NULL,
	"ot_id" varchar(10),
	"device_id" varchar(10),
	"appointment_date" timestamp NOT NULL,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"treated_side" varchar(20),
	"status" varchar(20) DEFAULT 'SCHEDULED' NOT NULL,
	"note" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("patient_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_ot_id_occupational_therapists_ot_id_fk" FOREIGN KEY ("ot_id") REFERENCES "public"."occupational_therapists"("ot_id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_device_id_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("device_id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "appointments_patient_idx" ON "appointments" ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointments_date_idx" ON "appointments" ("appointment_date");
