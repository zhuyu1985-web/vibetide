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
import { missions } from "./missions";
import { artifactTypeEnum } from "./enums";

// ─── Workflow Templates (kept for leader reference during task decomposition) ───

export const workflowTemplates = pgTable("workflow_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: text("name").notNull(),
  description: text("description"),
  steps: jsonb("steps")
    .$type<
      {
        key: string;
        label: string;
        employeeSlug: string;
        order: number;
      }[]
    >()
    .notNull(),

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
