import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { appointments } from "./appointments";
import { users } from "./users";

// ประวัติการแก้ไขบันทึกหลังบันทึกผลแล้ว — appointments.soap_* ฉบับเดิมไม่ถูกแก้ (trigger lock_saved_soap)
// field: S / O / A / P หรือ REPS (จำนวนครั้งของเซต)
export const soapAmendments = pgTable("soap_amendments", {
  amendment_id: varchar("amendment_id").primaryKey().notNull(), // default gen_random_uuid()
  appointment_id: varchar("appointment_id").notNull().references(() => appointments.appointment_id),
  field: varchar("field").notNull(),
  old_value: text("old_value"),
  new_value: text("new_value"),
  reason: text("reason"),
  amended_by: varchar("amended_by").notNull().references(() => users.users_id),
  amended_at: timestamp("amended_at").defaultNow(),
});
