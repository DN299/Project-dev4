import { pgTable, varchar, timestamp, date } from "drizzle-orm/pg-core";
import { patients } from "./patients";
import { treatmentCases } from "./treatmentCases";
import { occupationalTherapists } from "./occupationalTherapist";
import { appointments } from "./appointments";
import { users } from "./users";

// F1.5 คำขอนัด — นักกายภาพระบุช่วงวันที่ต้องการ (earliest_date..latest_date) เวชระเบียนเลือกช่องจริงแล้วบันทึกนัด
// status: PENDING → BOOKED (มี appointment_id) หรือ CANCELLED · เคสหนึ่งมีคำขอที่รอได้ทีละรายการ (one_pending_request_per_case)
export const appointmentRequests = pgTable("appointment_requests", {
  request_id: varchar("request_id").primaryKey().notNull(),
  patient_id: varchar("patient_id").notNull().references(() => patients.patient_id),
  case_id: varchar("case_id").references(() => treatmentCases.case_id),
  ot_id: varchar("ot_id").references(() => occupationalTherapists.ot_id),
  requested_by: varchar("requested_by").references(() => users.users_id),
  window_label: varchar("window_label"),
  earliest_date: date("earliest_date").notNull(),
  latest_date: date("latest_date").notNull(),
  note: varchar("note"),
  status: varchar("status").notNull().default("PENDING"),
  appointment_id: varchar("appointment_id").references(() => appointments.appointment_id),
  booked_by: varchar("booked_by").references(() => users.users_id),
  booked_at: timestamp("booked_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
