import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import type { InputFieldDef } from "@/lib/types";

export const employeeScenarios = pgTable("employee_scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  employeeSlug: text("employee_slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("Zap"),
  // Optional opening line sent as the first assistant message when the user
  // enters this scenario. Supports Markdown. May reference inputFields
  // placeholders ({{fieldName}}).
  welcomeMessage: text("welcome_message"),
  systemInstruction: text("system_instruction").notNull(),
  inputFields: jsonb("input_fields")
    .$type<InputFieldDef[]>()
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
}, (table) => ({
  // Natural key — prevents duplicate scenario rows per employee per org.
  // Without this, re-running `npm run db:seed` appended fresh copies every
  // time (seed uses plain INSERT without onConflictDoNothing). We saw 7x
  // duplicates in the wild.
  orgEmployeeNameUidx: uniqueIndex("employee_scenarios_org_slug_name_uidx")
    .on(table.organizationId, table.employeeSlug, table.name),
}));

export const employeeScenariosRelations = relations(
  employeeScenarios,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [employeeScenarios.organizationId],
      references: [organizations.id],
    }),
  })
);
