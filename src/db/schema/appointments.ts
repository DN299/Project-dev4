import { pgTable, varchar, timestamp, integer, text, decimal } from "drizzle-orm/pg-core";
import { users } from "./users";
import { patients } from "./patients";
import { occupationalTherapists } from "./occupationalTherapist";
import { devices } from "./devices";
import { treatmentCases } from "./treatmentCases";

export const appointments = pgTable("appointments", {
  appointment_id: varchar("appointment_id", { length: 10 })
    .primaryKey()
    .notNull(),

  patient_id: varchar("patient_id", { length: 10 })
    .notNull()
    .references(() => patients.patient_id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),

  ot_id: varchar("ot_id", { length: 10 }).references(
    () => occupationalTherapists.ot_id,
    {
      onDelete: "set null",
      onUpdate: "cascade",
    }
  ),

  device_id: varchar("device_id", { length: 10 }).references(
    () => devices.device_id,
    {
      onDelete: "set null",
      onUpdate: "cascade",
    }
  ),

  appointment_date: timestamp("appointment_date").notNull(),

  duration_min: integer("duration_min").notNull().default(60), // ช่องละ 1 ชั่วโมง (src/constants/slot.ts)

  // TRAINING = ฝึกกับกระดาน (ใช้ช่องกระดานร่วมทั้งศูนย์) / ASSESSMENT = ประเมินแรกรับ (ไม่ใช้กระดาน)
  appointment_type: varchar("appointment_type", { length: 20 }).notNull().default("TRAINING"),

  // ข้างที่รักษาในนัดครั้งนั้น (อาจต่างจากข้างหลักของผู้ป่วย)
  treated_side: varchar("treated_side", { length: 20 }),

  // SCHEDULED → CHECKED_IN (รับคิวแล้ว) → IN_PROGRESS (กำลังฝึก) → COMPLETED / NO_SHOW / CANCELLED
  status: varchar("status", { length: 20 }).notNull().default("SCHEDULED"),

  note: varchar("note", { length: 255 }),

  checked_in_at: timestamp("checked_in_at"),
  // คอร์สการรักษาที่นัดนี้อยู่
  case_id: varchar("case_id").references(() => treatmentCases.case_id),

  // ผู้ลงนัด / ผู้รักษาจริง (นักกายภาพที่เชื่อมต่อกระดาน — อาจไม่ใช่นักกายภาพประจำเคส)
  created_by: varchar("created_by").references(() => users.users_id),
  treated_by: varchar("treated_by").references(() => occupationalTherapists.ot_id),

  // เวชระเบียนเรียกคิว → ผู้ป่วยเห็น "รอเชื่อมต่อ" จนนักกายภาพเชื่อมต่อกระดาน
  called_at: timestamp("called_at"),
  called_by: varchar("called_by", { length: 10 }).references(() => users.users_id),

  // slot (tsrange) เป็น generated column ในฐานข้อมูล ใช้กับ exclusion constraint กันนัดชน — ห้ามเขียนเอง

  checked_in_by: varchar("checked_in_by", { length: 10 }).references(() => users.users_id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  started_at: timestamp("started_at"),
  completed_at: timestamp("completed_at"),

  // ข้อมูลที่เวชระเบียนกรอกตอนรับคิวครั้งนี้
  symptoms_today: text("symptoms_today"),
  weight_kg: decimal("weight_kg", { precision: 5, scale: 2 }),

  // บันทึกการรักษา (SOAP) ของนัดครั้งนี้ — soap_p เป็นคำแนะนำที่ผู้ป่วยเห็นในแอป
  soap_s: text("soap_s"),
  soap_o: text("soap_o"),
  soap_a: text("soap_a"),
  soap_p: text("soap_p"),
  soap_saved_at: timestamp("soap_saved_at"),

  created_at: timestamp("created_at").defaultNow().notNull(),
});
