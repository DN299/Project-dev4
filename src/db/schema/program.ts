import {
  pgTable,
  varchar,
  integer,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { PROGRAM_STATUS } from "@/src/constants/program";

export const programs = pgTable("programs", {
  program_id: varchar("program_id", { length: 10 }).primaryKey().notNull(),

  program_name: varchar("program_name", { length: 100 }).notNull(),

  description: text("description"),

  program_type: varchar("program_type", {
    length: 20,
  }).notNull(), // SYSTEM | CUSTOM

  // ระยะอาการของโรคที่โปรแกรมนี้ออกแบบมาให้ — EARLY | MIDDLE | LATE, null = ใช้ได้ทุกระยะ
  target_stage: varchar("target_stage", { length: 20 }),

  session_per_day: integer("session_per_day").notNull(),

  created_by: varchar("created_by", {
    length: 10,
  }).references(() => users.users_id, {
    onDelete: "restrict",
    onUpdate: "cascade",
  }), // User who created this program (Admin or Occupational Therapist)

  status: varchar("status", {
    length: 20,
  })
    .default(PROGRAM_STATUS.ACTIVE)
    .notNull(),

  duration_sec: integer("duration_sec").notNull(),

  created_at: timestamp("created_at").defaultNow().notNull(),

  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
