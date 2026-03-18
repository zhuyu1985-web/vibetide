import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import { skillCategoryEnum, skillTypeEnum, skillBindingTypeEnum } from "./enums";

export const skills = pgTable("skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: text("name").notNull(),
  category: skillCategoryEnum("category").notNull(),
  type: skillTypeEnum("type").notNull().default("builtin"),
  version: text("version").notNull().default("1.0"),
  description: text("description").notNull(),
  content: text("content").default(""),

  // Schema definitions
  inputSchema: jsonb("input_schema").$type<Record<string, string>>(),
  outputSchema: jsonb("output_schema").$type<Record<string, string>>(),

  // Runtime config
  runtimeConfig: jsonb("runtime_config").$type<{
    type: string;
    avgLatencyMs: number;
    maxConcurrency: number;
    modelDependency?: string;
  }>(),

  compatibleRoles: jsonb("compatible_roles").$type<string[]>().default([]),

  // Plugin configuration (for type='plugin')
  pluginConfig: jsonb("plugin_config").$type<{
    endpoint: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    authType?: "none" | "api_key" | "bearer";
    authKey?: string;
    requestTemplate?: string;
    responseMapping?: Record<string, string>;
    timeoutMs?: number;
  }>(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const employeeSkills = pgTable("employee_skills", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .references(() => aiEmployees.id, { onDelete: "cascade" })
    .notNull(),
  skillId: uuid("skill_id")
    .references(() => skills.id, { onDelete: "cascade" })
    .notNull(),
  level: integer("level").notNull().default(50), // proficiency 0-100
  bindingType: skillBindingTypeEnum("binding_type").notNull().default("extended"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const skillsRelations = relations(skills, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [skills.organizationId],
    references: [organizations.id],
  }),
  employeeSkills: many(employeeSkills),
}));

export const employeeSkillsRelations = relations(
  employeeSkills,
  ({ one }) => ({
    employee: one(aiEmployees, {
      fields: [employeeSkills.employeeId],
      references: [aiEmployees.id],
    }),
    skill: one(skills, {
      fields: [employeeSkills.skillId],
      references: [skills.id],
    }),
  })
);
