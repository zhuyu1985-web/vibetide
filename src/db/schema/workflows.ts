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
import { teams } from "./teams";
import { aiEmployees } from "./ai-employees";
import { workflowStepStatusEnum, artifactTypeEnum } from "./enums";

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

export const workflowInstances = pgTable("workflow_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").references(() => teams.id),
  templateId: uuid("template_id").references(() => workflowTemplates.id),

  topicId: text("topic_id"),
  topicTitle: text("topic_title").notNull(),

  status: text("status").notNull().default("active"), // active, completed, cancelled
  inngestRunId: text("inngest_run_id"),
  currentStepKey: text("current_step_key"),

  // Token budget
  tokenBudget: integer("token_budget").notNull().default(100000),
  tokensUsed: integer("tokens_used").notNull().default(0),

  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  estimatedCompletion: timestamp("estimated_completion", {
    withTimezone: true,
  }),
  completedAt: timestamp("completed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const workflowSteps = pgTable("workflow_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowInstanceId: uuid("workflow_instance_id")
    .references(() => workflowInstances.id, { onDelete: "cascade" })
    .notNull(),

  key: text("key").notNull(),
  label: text("label").notNull(),
  employeeId: uuid("employee_id").references(() => aiEmployees.id),
  stepOrder: integer("step_order").notNull(),

  status: workflowStepStatusEnum("status").notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  output: text("output"),
  structuredOutput: jsonb("structured_output"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),

  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const workflowArtifacts = pgTable("workflow_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workflowInstanceId: uuid("workflow_instance_id")
    .references(() => workflowInstances.id, { onDelete: "cascade" })
    .notNull(),

  artifactType: artifactTypeEnum("artifact_type").notNull(),
  title: text("title").notNull(),
  content: jsonb("content"),
  textContent: text("text_content"),

  producerEmployeeId: uuid("producer_employee_id").references(
    () => aiEmployees.id
  ),
  producerStepKey: text("producer_step_key"),
  version: integer("version").notNull().default(1),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const workflowTemplatesRelations = relations(
  workflowTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [workflowTemplates.organizationId],
      references: [organizations.id],
    }),
    instances: many(workflowInstances),
  })
);

export const workflowInstancesRelations = relations(
  workflowInstances,
  ({ one, many }) => ({
    team: one(teams, {
      fields: [workflowInstances.teamId],
      references: [teams.id],
    }),
    template: one(workflowTemplates, {
      fields: [workflowInstances.templateId],
      references: [workflowTemplates.id],
    }),
    steps: many(workflowSteps),
    artifacts: many(workflowArtifacts),
  })
);

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  workflowInstance: one(workflowInstances, {
    fields: [workflowSteps.workflowInstanceId],
    references: [workflowInstances.id],
  }),
  employee: one(aiEmployees, {
    fields: [workflowSteps.employeeId],
    references: [aiEmployees.id],
  }),
}));

export const workflowArtifactsRelations = relations(
  workflowArtifacts,
  ({ one }) => ({
    workflowInstance: one(workflowInstances, {
      fields: [workflowArtifacts.workflowInstanceId],
      references: [workflowInstances.id],
    }),
    producerEmployee: one(aiEmployees, {
      fields: [workflowArtifacts.producerEmployeeId],
      references: [aiEmployees.id],
    }),
  })
);
