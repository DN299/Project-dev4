import { pgTable, varchar } from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
  role_id: varchar("role_id", { length: 5 }).primaryKey(),
  role_name: varchar("role_name", { length: 50 }).notNull(),
});