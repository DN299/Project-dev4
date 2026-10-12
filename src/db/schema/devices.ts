import {
  pgTable,
  varchar,
  integer,
  decimal,
  timestamp,
  real,
  text,
} from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
  device_id: varchar("device_id", { length: 10 }).primaryKey().notNull(),
  device_name: varchar("device_name", { length: 100 }).notNull(),

  serial_number: varchar("serial_number", { length: 100 }).notNull().unique(),

  status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),

  // ---------- ของเพื่อน ----------
  // กุญแจของบอร์ด (เก็บเป็นค่า hash) ใช้กับ PATCH /api/devices { issueKey: true }
  api_key: text("api_key"),
  // นัดที่เครื่องผูกอยู่ตอนนี้ (trigger ในฐานข้อมูลเขียน/ล้างให้)
  current_appointment_id: varchar("current_appointment_id"),

  // เทเลเมทรีของอุปกรณ์ skateboard rehab
  connection_status: varchar("connection_status", { length: 20 })
    .notNull()
    .default("DISCONNECTED"), // CONNECTED | DISCONNECTED

  battery_level: integer("battery_level"), // 0-100, null = ไม่ทราบ/ยังไม่เคยเชื่อมต่อ

  imu_status: varchar("imu_status", { length: 20 })
    .notNull()
    .default("UNKNOWN"), // OK | WARNING | ERROR | UNKNOWN

  encoder_status: varchar("encoder_status", { length: 20 })
    .notNull()
    .default("UNKNOWN"), // OK | WARNING | ERROR | UNKNOWN

  last_seen_at: timestamp("last_seen_at", { withTimezone: true }),

  live_status: varchar("live_status", { length: 20 }).notNull().default("IDLE"), // IDLE | RUNNING

  live_reps: integer("live_reps"), // null = ไม่ได้อยู่ระหว่างเซต

  voltage: decimal("voltage", { precision: 5, scale: 2 }), // แรงดันแหล่งจ่าย (V)

  current_a: decimal("current_a", { precision: 5, scale: 2 }), // กระแสจาก Pmod ISNS20 (A)

  // คำสั่งจากแอปที่รอให้อุปกรณ์มารับตอน heartbeat ครั้งถัดไป
  pending_command: varchar("pending_command", { length: 20 }), // START | STOP | null

  // ---------- ของเรา (ระบบฝึกสเก็ตบอร์ด) ----------
  holder_patient_id: varchar("holder_patient_id", { length: 50 }), // ผู้ป่วยที่กดเชื่อมต่อเครื่องอยู่
  live_angle: real("live_angle"),
  live_phase: varchar("live_phase", { length: 10 }), // GO | RETURN | null
  current_side: varchar("current_side", { length: 10 }), // RIGHT | LEFT | null
  set_started_at: timestamp("set_started_at", { withTimezone: true }), // เวลาเริ่มเซตที่กำลังฝึก (ฐานข้อมูลจดเองตอนบอร์ดเป็น RUNNING)

  created_at: timestamp("created_at").defaultNow().notNull(),
});
