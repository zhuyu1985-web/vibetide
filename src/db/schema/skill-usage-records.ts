import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { skills } from "./skills";
import { aiEmployees } from "./ai-employees";
import { organizations } from "./users";

export const skillUsageRecords = pgTable("skill_usage_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillId: uuid("skill_id")
    .references(() => skills.id, { onDelete: "cascade" })
    .notNull(),
  employeeId: uuid("employee_id")
    .references(() => aiEmployees.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // Execution context
  workflowInstanceId: uuid("workflow_instance_id"),
  workflowStepId: uuid("workflow_step_id"),

  // Result
  success: integer("success").notNull().default(1), // 1=success, 0=failure
  qualityScore: integer("quality_score"), // 0-100
  executionTimeMs: integer("execution_time_ms"),
  tokenUsage: integer("token_usage"),
  errorMessage: text("error_message"),

  // Context
  inputSummary: text("input_summary"),
  outputSummary: text("output_summary"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const skillUsageRecordsRelations = relations(
  skillUsageRecords,
  ({ one }) => ({
    skill: one(skills, {
      fields: [skillUsageRecords.skillId],
      references: [skills.id],
    }),
    employee: one(aiEmployees, {
      fields: [skillUsageRecords.employeeId],
      references: [aiEmployees.id],
    }),
    organization: one(organizations, {
      fields: [skillUsageRecords.organizationId],
      references: [organizations.id],
    }),
  })
);
