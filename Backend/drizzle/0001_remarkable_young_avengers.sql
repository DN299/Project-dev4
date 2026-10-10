ALTER TABLE "users" RENAME COLUMN "profileImage" TO "profile_image";--> statement-breakpoint
ALTER TABLE "patients" RENAME COLUMN "registerdate" TO "register_date";--> statement-breakpoint
ALTER TABLE "occupational_therapists" RENAME COLUMN "OT_id" TO "ot_id";--> statement-breakpoint
ALTER TABLE "occupational_therapists" RENAME COLUMN "licensenumber" TO "license_number";--> statement-breakpoint
ALTER TABLE "medical_records_staff" RENAME COLUMN "medicalRecordsStaff_id" TO "medical_records_staff_id";--> statement-breakpoint
ALTER TABLE "programs" DROP CONSTRAINT "programs_OT_id_occupational_therapists_OT_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_programs" DROP CONSTRAINT "patient_programs_assigned_by_occupational_therapists_OT_id_fk";
--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_OT_id_occupational_therapists_ot_id_fk" FOREIGN KEY ("OT_id") REFERENCES "public"."occupational_therapists"("ot_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "patient_programs" ADD CONSTRAINT "patient_programs_assigned_by_occupational_therapists_ot_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."occupational_therapists"("ot_id") ON DELETE restrict ON UPDATE cascade;