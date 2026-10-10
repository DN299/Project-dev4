import { pgTable, varchar, text, integer, timestamp } from "drizzle-orm/pg-core";
import { patients } from "./patients";
import { occupationalTherapists } from "./occupationalTherapist";

// หนึ่งคอร์สการรักษา · ผู้ป่วยมีเคสที่ยังไม่ปิดได้ทีละเคส (unique index one_open_case_per_patient)
// status: PENDING_ASSESSMENT (รอประเมิน) → ACTIVE (กำลังรักษา) → CLOSED (เสร็จสิ้นการรักษา)
export const treatmentCases = pgTable("treatment_cases", {
  case_id: varchar("case_id").primaryKey().notNull(),
  patient_id: varchar("patient_id").notNull().references(() => patients.patient_id),
  primary_ot_id: varchar("primary_ot_id").references(() => occupationalTherapists.ot_id),
  status: varchar("status").notNull().default("PENDING_ASSESSMENT"),

  // ซักประวัติจากเวชระเบียน (ตามที่ผู้ป่วยเล่า)
  chief_complaint: text("chief_complaint"),
  pain_level: integer("pain_level"), // 0–10
  symptom_location: varchar("symptom_location"),
  onset_duration: varchar("onset_duration"),

  // ผลประเมินโดยนักกายภาพ — ระยะ EARLY / MIDDLE / LATE
  affected_side: varchar("affected_side"),
  start_stage: varchar("start_stage"),
  current_stage: varchar("current_stage"),
  assessment_note: text("assessment_note"),
  assessed_at: timestamp("assessed_at"),

  opened_at: timestamp("opened_at").defaultNow(),
  closed_at: timestamp("closed_at"),
  close_reason: varchar("close_reason"),
  close_stage: varchar("close_stage"),
  close_summary: text("close_summary"),
});
