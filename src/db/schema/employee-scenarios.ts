import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

export const employeeScenarios = pgTable("employee_scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  employeeSlug: text("employee_slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("Zap"),
  systemInstruction: text("system_instruction").notNull(),
  inputFields: jsonb("input_fields")
    .$type<
      {
        name: string;
        label: string;
        type: "text" | "textarea" | "select";
        required: boolean;
        placeholder?: string;
        options?: string[];
      }[]
    >()
    .notNull()
    .default([]),
  toolsHint: jsonb("tools_hint").$type<string[]>().notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const employeeScenariosRelations = relations(
  employeeScenarios,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [employeeScenarios.organizationId],
      references: [organizations.id],
    }),
  })
);
