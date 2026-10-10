import { pgTable, varchar, date } from "drizzle-orm/pg-core";
import { patients } from "./patients";
import { treatmentCases } from "./treatmentCases";
import { programs } from "./program";
import { occupationalTherapists } from "./occupationalTherapist";

export const patientPrograms = pgTable("patient_programs", {
  patient_program_id: varchar("patient_program_id", { length: 10 })
    .primaryKey()
    .notNull(),

  patient_id: varchar("patient_id", { length: 10 })
    .notNull()
    .references(() => patients.patient_id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),

  program_id: varchar("program_id", { length: 10 })
    .notNull()
    .references(() => programs.program_id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),

  assigned_by: varchar("assigned_by", { length: 10 })
    .notNull()
    .references(() => occupationalTherapists.ot_id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),

  assigned_date: date("assigned_date").defaultNow(),

  start_date: date("start_date"),

  end_date: date("end_date"),

  status: varchar("status", { length: 20 }).default("ACTIVE"),

  // โปรแกรมที่มอบให้ในเคส (คอร์ส) นั้น
  case_id: varchar("case_id").references(() => treatmentCases.case_id),
});
