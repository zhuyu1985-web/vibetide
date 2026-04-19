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
import { aiEmployees } from "./ai-employees";
import { missions } from "./missions";
import {
  artifactTypeEnum,
  workflowCategoryEnum,
  workflowTriggerTypeEnum,
} from "./enums";
import type { InputFieldDef } from "@/lib/types";

// ─── Workflow Step Definition ───

export interface WorkflowStepDef {
  id: string;
  order: number;
  dependsOn: string[];
  name: string;
  type: "skill" | "output";
  config: {
    skillSlug?: string;
    skillName?: string;
    skillCategory?: string;
    outputAction?: string;
    parameters: Record<string, any>;
    description?: string;
    /** @deprecated kept for backward compat with old data */
    employeeSlug?: string;
    toolId?: string;
  };
  // Backward compat with old seed format
  key?: string;
  label?: string;
  /** @deprecated use config.skillSlug */
  employeeSlug?: string;
}

// ─── Workflow Templates (kept for leader reference during task decomposition) ───

export const workflowTemplates = pgTable("workflow_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: text("name").notNull(),
  description: text("description"),
  steps: jsonb("steps").$type<WorkflowStepDef[]>().notNull(),

  category: workflowCategoryEnum("category").default("custom"),
  triggerType: workflowTriggerTypeEnum("trigger_type").default("manual"),
  triggerConfig: jsonb("trigger_config").$type<{
    cron?: string;
    timezone?: string;
  } | null>(),
  isBuiltin: boolean("is_builtin").notNull().default(false),
  isEnabled: boolean("is_enabled").notNull().default(false),
  createdBy: uuid("created_by"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  runCount: integer("run_count").notNull().default(0),

  // B.1 Unified Scenario Workflow extensions
  icon: text("icon"),
  inputFields: jsonb("input_fields").$type<InputFieldDef[]>().default([]),
  defaultTeam: jsonb("default_team").$type<string[]>().default([]),
  appChannelSlug: text("app_channel_slug"),
  systemInstruction: text("system_instruction"),
  legacyScenarioKey: text("legacy_scenario_key"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Workflow Artifacts (now linked to missions instead of workflow_instances) ───

export const workflowArtifacts = pgTable("workflow_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id")
    .references(() => missions.id, { onDelete: "cascade" })
    .notNull(),

  artifactType: artifactTypeEnum("artifact_type").notNull(),
  title: text("title").notNull(),
  content: jsonb("content"),
  textContent: text("text_content"),

  producerEmployeeId: uuid("producer_employee_id").references(
    () => aiEmployees.id
  ),
  producerTaskId: uuid("producer_task_id"), // references mission_tasks, kept as plain uuid to avoid circular
  version: integer("version").notNull().default(1),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Relations ───

export const workflowTemplatesRelations = relations(
  workflowTemplates,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [workflowTemplates.organizationId],
      references: [organizations.id],
    }),
  })
);

export const workflowArtifactsRelations = relations(
  workflowArtifacts,
  ({ one }) => ({
    mission: one(missions, {
      fields: [workflowArtifacts.missionId],
      references: [missions.id],
    }),
    producerEmployee: one(aiEmployees, {
      fields: [workflowArtifacts.producerEmployeeId],
      references: [aiEmployees.id],
    }),
  })
);
