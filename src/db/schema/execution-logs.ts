import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import { missions, missionTasks } from "./missions";

/**
 * Execution logs — records every Agent execution for learning and debugging.
 */
export const executionLogs = pgTable("execution_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  // What was executed
  employeeId: uuid("employee_id")
    .references(() => aiEmployees.id)
    .notNull(),
  missionId: uuid("mission_id").references(() => missions.id),
  missionTaskId: uuid("mission_task_id").references(() => missionTasks.id),

  // Input context
  stepLabel: text("step_label"),
  topicTitle: text("topic_title"),
  scenario: text("scenario"),

  // Output
  outputSummary: text("output_summary"),
  outputFull: jsonb("output_full"),

  // Metrics
  tokensInput: integer("tokens_input").notNull().default(0),
  tokensOutput: integer("tokens_output").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  toolCallCount: integer("tool_call_count").notNull().default(0),

  // Model info
  modelId: text("model_id"),
  temperature: jsonb("temperature").$type<number>(),

  // Outcome
  status: text("status").notNull().default("success"), // success | failed

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const executionLogsRelations = relations(executionLogs, ({ one }) => ({
  employee: one(aiEmployees, {
    fields: [executionLogs.employeeId],
    references: [aiEmployees.id],
  }),
  mission: one(missions, {
    fields: [executionLogs.missionId],
    references: [missions.id],
  }),
  missionTask: one(missionTasks, {
    fields: [executionLogs.missionTaskId],
    references: [missionTasks.id],
  }),
  organization: one(organizations, {
    fields: [executionLogs.organizationId],
    references: [organizations.id],
  }),
}));
