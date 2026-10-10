import {
  pgTable,
  varchar,
  decimal,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { therapySessions } from "./therapySession";
import { devices } from "./devices";

export const movementData = pgTable("movement_data", {
  movement_id: varchar("movement_id", { length: 10 }).primaryKey().notNull(),

  session_id: varchar("session_id", { length: 10 })
    .notNull()
    .references(() => therapySessions.session_id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),

  device_id: varchar("device_id", { length: 10 })
    .notNull()
    .references(() => devices.device_id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),

  movement_count: integer("movement_count").notNull(),

  movement_distance: decimal("movement_distance", {
    precision: 6,
    scale: 2,
  }),

  recorded_at: timestamp("recorded_at").defaultNow().notNull(),
});
