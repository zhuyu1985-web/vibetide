import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { aiEmployees } from "./ai-employees";

export const employeeConfigVersions = pgTable("employee_config_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .references(() => aiEmployees.id)
    .notNull(),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(), // full employee config at this point
  changedBy: uuid("changed_by"), // user who made the change
  changedFields: jsonb("changed_fields").$type<string[]>(), // array of field names that changed
  changeDescription: text("change_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
