import { pgTable, varchar, timestamp, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { roles } from "./roles";

export const users = pgTable("users", {
  users_id: varchar("users_id", { length: 10 }).primaryKey().notNull(),

  role_id: varchar("role_id", { length: 5 })
    .notNull()
    .references(() => roles.role_id),

  username: varchar("username", { length: 50 }).notNull().unique(),

  password: varchar("password", { length: 255 }).notNull(),

  first_name: varchar("first_name", { length: 50 }).notNull(),

  last_name: varchar("last_name", { length: 50 }).notNull(),

  phone: varchar("phone", { length: 15 }),

  email: varchar("email", { length: 100 }).unique(),

  profile_image: varchar("profile_image", { length: 255 }),

  gender: varchar("gender", { length: 10 }),

  birth_date: date("birth_date"),

  status: varchar("status", { length: 20 }).default("ACTIVE"),

  created_at: timestamp("created_at").defaultNow().notNull(),

  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
