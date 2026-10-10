CREATE TABLE "devices" (
	"device_id" varchar(10) PRIMARY KEY NOT NULL,
	"device_name" varchar(100) NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "devices_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"feedback_id" varchar(10) PRIMARY KEY NOT NULL,
	"session_id" varchar(10) NOT NULL,
	"rating" integer,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"role_id" varchar(5) PRIMARY KEY NOT NULL,
	"role_name" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"users_id" varchar(10) PRIMARY KEY NOT NULL,
	"role_id" varchar(5) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password" varchar(255) NOT NULL,
	"first_name" varchar(50) NOT NULL,
	"last_name" varchar(50) NOT NULL,
	"phone" varchar(15),
	"email" varchar(100),
	"profileImage" varchar(255),
	"gender" varchar(10),
	"birth_date" date,
	"status" varchar(20) DEFAULT 'ACTIVE',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"patient_id" varchar(10) PRIMARY KEY NOT NULL,
	"users_id" varchar(10) NOT NULL,
	"medical_condition" varchar(255),
	"weight" numeric(5, 2),
	"registerdate" date DEFAULT now(),
	"address" varchar(255),
	CONSTRAINT "patients_users_id_unique" UNIQUE("users_id")
);
--> statement-breakpoint
CREATE TABLE "occupational_therapists" (
	"OT_id" varchar(10) PRIMARY KEY NOT NULL,
	"users_id" varchar(10) NOT NULL,
	"licensenumber" varchar(50),
	CONSTRAINT "occupational_therapists_users_id_unique" UNIQUE("users_id")
);
--> statement-breakpoint
CREATE TABLE "medical_records_staff" (
	"medicalRecordsStaff_id" varchar(10) PRIMARY KEY NOT NULL,
	"users_id" varchar(10) NOT NULL,
	CONSTRAINT "medical_records_staff_users_id_unique" UNIQUE("users_id")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"program_id" varchar(10) PRIMARY KEY NOT NULL,
	"OT_id" varchar(10) NOT NULL,
	"program_name" varchar(100) NOT NULL,
	"description" text,
	"repeat_count" integer NOT NULL,
	"session_per_day" integer NOT NULL,
	"duration_sec" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_programs" (
	"patient_program_id" varchar(10) PRIMARY KEY NOT NULL,
	"patient_id" varchar(10) NOT NULL,
	"program_id" varchar(10) NOT NULL,
	"assigned_by" varchar(10) NOT NULL,
	"assigned_date" date DEFAULT now(),
	"start_date" date,
	"end_date" date,
	"status" varchar(20) DEFAULT 'ACTIVE'
);
--> statement-breakpoint
CREATE TABLE "therapy_sessions" (
	"session_id" varchar(10) PRIMARY KEY NOT NULL,
	"patient_program_id" varchar(10) NOT NULL,
	"session_date" timestamp DEFAULT now() NOT NULL,
	"duration_sec" integer NOT NULL,
	"total_reps" integer NOT NULL,
	"status" varchar(20) DEFAULT 'COMPLETED'
);
--> statement-breakpoint
CREATE TABLE "movement_data" (
	"movement_id" varchar(10) PRIMARY KEY NOT NULL,
	"session_id" varchar(10) NOT NULL,
	"device_id" varchar(10) NOT NULL,
	"movement_count" integer NOT NULL,
	"movement_distance" numeric(6, 2),
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_session_id_therapy_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("session_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("role_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_users_id_users_users_id_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("users_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "occupational_therapists" ADD CONSTRAINT "occupational_therapists_users_id_users_users_id_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("users_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "medical_records_staff" ADD CONSTRAINT "medical_records_staff_users_id_users_users_id_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("users_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_OT_id_occupational_therapists_OT_id_fk" FOREIGN KEY ("OT_id") REFERENCES "public"."occupational_therapists"("OT_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "patient_programs" ADD CONSTRAINT "patient_programs_patient_id_patients_patient_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("patient_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "patient_programs" ADD CONSTRAINT "patient_programs_program_id_programs_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("program_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "patient_programs" ADD CONSTRAINT "patient_programs_assigned_by_occupational_therapists_OT_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."occupational_therapists"("OT_id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "therapy_sessions" ADD CONSTRAINT "therapy_sessions_patient_program_id_patient_programs_patient_program_id_fk" FOREIGN KEY ("patient_program_id") REFERENCES "public"."patient_programs"("patient_program_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "movement_data" ADD CONSTRAINT "movement_data_session_id_therapy_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."therapy_sessions"("session_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "movement_data" ADD CONSTRAINT "movement_data_device_id_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("device_id") ON DELETE restrict ON UPDATE cascade;