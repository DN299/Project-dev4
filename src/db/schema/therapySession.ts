import { pgTable, varchar, timestamp, integer, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { patientPrograms } from "./patientProgram";
import { appointments } from "./appointments";

export const therapySessions = pgTable("therapy_sessions", {
  session_id: varchar("session_id", { length: 10 }).primaryKey().notNull(),

  patient_program_id: varchar("patient_program_id", { length: 10 })
    .notNull()
    .references(() => patientPrograms.patient_program_id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),

  session_date: timestamp("session_date").defaultNow().notNull(),

  duration_sec: integer("duration_sec").notNull(),

  total_reps: integer("total_reps").notNull(),

  status: varchar("status", { length: 20 }).default("COMPLETED"),

  // ความเหนื่อยที่ผู้ป่วยให้หลังจบเซต (1 ไม่เหนื่อย – 5 เหนื่อยมาก)
  fatigue_level: integer("fatigue_level"),

  // ลำดับเซตในนัดนั้น — trigger session_guard นับให้เอง
  set_number: integer("set_number").notNull().default(1),

  patient_comment: text("patient_comment"),

  // นัดที่เซตนี้เกิดขึ้น — ต้องเป็นนัดที่กำลังฝึก (trigger session_guard)
  appointment_id: varchar("appointment_id", { length: 10 }).references(() => appointments.appointment_id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});
