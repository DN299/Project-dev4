import {
  pgTable,
  varchar,
  integer,
  decimal,
  timestamp,
  real,
  text,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const devices = pgTable("devices", {
  device_id: varchar("device_id", { length: 10 })
  .primaryKey()
  .notNull(),
  device_name: varchar("device_name", { length: 100 }).notNull(),

  serial_number: varchar("serial_number", { length: 100 })
    .notNull()
    .unique(),

  status: varchar("status", { length: 20 })
    .notNull()
    .default("ACTIVE"),

  // เทเลเมทรีของอุปกรณ์ skateboard rehab — รายงานจากตัวอุปกรณ์ผ่านไฟร์มแวร์ (อุปกรณ์ส่งเข้ามาผ่าน POST /api/devices/telemetry)
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

  last_seen_at: timestamp("last_seen_at"),

  // ค่าสดระหว่างฝึก รายงานผ่าน POST /api/devices/telemetry
  live_status: varchar("live_status", { length: 20 })
    .notNull()
    .default("IDLE"), // IDLE | RUNNING

  live_reps: integer("live_reps"), // null = ไม่ได้อยู่ระหว่างเซต

  voltage: decimal("voltage", { precision: 5, scale: 2 }), // แรงดันแหล่งจ่าย (V)

  current_a: decimal("current_a", { precision: 5, scale: 2 }), // กระแสจาก Pmod ISNS20 (A)

  // คำสั่งจากแอปที่รอให้อุปกรณ์มารับตอนส่ง telemetry ครั้งถัดไป
  pending_command: varchar("pending_command", { length: 20 }), // START | STOP | null

  // นัดที่เครื่องผูกอยู่ตอนนี้ — trigger appt_bind_device เขียน/ล้างให้ตามสถานะนัด (IN_PROGRESS)
  // บอร์ดไม่ต้องรู้ว่าวัดใคร ฐานข้อมูลโยงจากนัดไปหาผู้ป่วยเอง
  current_appointment_id: varchar("current_appointment_id"),
  holder_patient_id: varchar("holder_patient_id", { length: 50 }),

  live_angle: real("live_angle"),
  live_phase: varchar("live_phase", { length: 10 }),

  api_key: text("api_key").unique(),

  created_at: timestamp("created_at")
    .defaultNow()
    .notNull(),
});