ALTER TABLE "programs" DROP CONSTRAINT "programs_OT_id_occupational_therapists_ot_id_fk";
--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "program_type" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "created_by" varchar(10);--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "status" varchar(20) DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_users_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("users_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "OT_id";