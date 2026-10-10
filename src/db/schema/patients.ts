import { pgTable, varchar, date, boolean } from "drizzle-orm/pg-core";
import { users } from "./users";

// ข้อมูลประจำตัวและผู้ดูแลเท่านั้น — ข้อมูลการรักษาอยู่ใน treatment_cases (หนึ่งแถวต่อหนึ่งคอร์ส)
export const patients = pgTable("patients", {
  patient_id: varchar("patient_id", { length: 10 }).primaryKey().notNull(),

  users_id: varchar("users_id", { length: 10 })
    .notNull()
    .unique()
    .references(() => users.users_id, { onDelete: "cascade", onUpdate: "cascade" }),

  register_date: date("register_date").defaultNow(),

  address: varchar("address", { length: 255 }),

  // ผู้ดูแลหลัก (ญาติ/คนดูแล) — ใช้บัญชีแทนผู้ป่วยได้ถ้า caretaker_can_use_app
  caretaker_name: varchar("caretaker_name", { length: 100 }),
  caretaker_phone: varchar("caretaker_phone", { length: 20 }),
  caretaker_relation: varchar("caretaker_relation", { length: 50 }),
  caretaker_can_use_app: boolean("caretaker_can_use_app"),
});
