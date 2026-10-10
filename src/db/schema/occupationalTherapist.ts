import { pgTable, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const occupationalTherapists = pgTable("occupational_therapists", {
  ot_id: varchar("ot_id", { length: 10 }).primaryKey().notNull(),

  users_id: varchar("users_id", { length: 10 })
    .notNull()
    .unique()
    .references(() => users.users_id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),

  license_number: varchar("license_number", { length: 50 }).notNull(),
});
