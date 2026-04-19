import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import {
  missionStatusEnum,
  missionTaskStatusEnum,
  missionMessageTypeEnum,
  missionPhaseEnum,
} from "./enums";

// ─── Missions (task sessions — replaces workflow_instances + teams) ───

export const missions = pgTable("missions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  title: text("title").notNull(),
  scenario: text("scenario").notNull(), // breaking_news, deep_report, social_media, custom
  userInstruction: text("user_instruction").notNull(),

  // Team leader (coordinator agent)
  leaderEmployeeId: uuid("leader_employee_id")
    .references(() => aiEmployees.id)
    .notNull(),

  // Dynamic team composition (employee DB IDs)
  teamMembers: jsonb("team_members").$type<string[]>().default([]),

  status: missionStatusEnum("status").notNull().default("planning"),

  // 5-phase lifecycle
  description: text("description"),
  phase: missionPhaseEnum("phase"),
  progress: integer("progress").notNull().default(0),
  config: jsonb("config")
    .$type<{ max_retries: number; task_timeout: number; max_agents: number; archived?: boolean; archivedAt?: string }>()
    .default({ max_retries: 3, task_timeout: 300, max_agents: 8 }),

  // Leader's consolidated final output
  finalOutput: jsonb("final_output"),

  // Cross-module trigger source
  sourceModule: text("source_module"),      // 'hot_topics' | 'publishing' | 'benchmarking' | 'analytics' | 'creation' | 'inspiration'
  sourceEntityId: text("source_entity_id"), // ID of triggering entity
  sourceEntityType: text("source_entity_type"), // 'hot_topic' | 'publish_plan' | 'benchmark_alert' | 'anomaly' | 'creation_session'

  // B.1 Unified Scenario Workflow: link mission → template that spawned it.
  // Deferred reference (no .references()) to avoid circular import with ./workflows.
  // FK constraint is enforced in the DB migration layer (missions_workflow_template_id_fkey).
  workflowTemplateId: uuid("workflow_template_id"),

  // Token budget
  tokenBudget: integer("token_budget").notNull().default(200000),
  tokensUsed: integer("tokens_used").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  // Deduplicate missions that were triggered by an external source (IM
  // message, review decision, anomaly alert, …). Without this, at-least-once
  // webhook delivery + IM-platform retries silently create duplicate rows.
  // Partial index: only rows with a source_entity_id participate.
  sourceDedupUidx: uniqueIndex("missions_source_dedup_uidx")
    .on(table.organizationId, table.sourceModule, table.sourceEntityId)
    .where(sql`${table.sourceEntityId} IS NOT NULL`),
}));

// ─── Mission Tasks (shared task board — DAG-based, replaces workflow_steps) ───

export const missionTasks = pgTable("mission_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id")
    .references(() => missions.id, { onDelete: "cascade" })
    .notNull(),

  title: text("title").notNull(),
  description: text("description").notNull(),
  expectedOutput: text("expected_output"),

  // Assignment
  assignedEmployeeId: uuid("assigned_employee_id").references(
    () => aiEmployees.id
  ),

  status: missionTaskStatusEnum("status").notNull().default("pending"),

  // DAG dependencies: IDs of tasks that must complete before this one
  dependencies: jsonb("dependencies").$type<string[]>().default([]),

  priority: integer("priority").notNull().default(0), // higher = more important

  // Acceptance & role
  acceptanceCriteria: text("acceptance_criteria"),
  assignedRole: text("assigned_role"),
  outputSummary: text("output_summary"),

  // Data flow
  inputContext: jsonb("input_context"), // aggregated outputs from dependency tasks
  outputData: jsonb("output_data"), // this task's execution result

  errorMessage: text("error_message"),
  errorRecoverable: integer("error_recoverable").notNull().default(1),
  retryCount: integer("retry_count").notNull().default(0),

  // Progress tracking
  phase: integer("phase"),
  progress: integer("progress").notNull().default(0),

  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Mission Messages (P2P communication — replaces team_messages) ───

export const missionMessages = pgTable("mission_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id")
    .references(() => missions.id, { onDelete: "cascade" })
    .notNull(),

  // Sender
  fromEmployeeId: uuid("from_employee_id")
    .references(() => aiEmployees.id)
    .notNull(),

  // Recipient (null = broadcast to all team members)
  toEmployeeId: uuid("to_employee_id").references(() => aiEmployees.id),

  messageType: missionMessageTypeEnum("message_type").notNull(),
  content: text("content").notNull(),

  // Message routing
  channel: text("channel").notNull().default("direct"), // direct/broadcast/system
  structuredData: jsonb("structured_data"),
  priority: text("priority").notNull().default("normal"), // normal/urgent
  replyTo: uuid("reply_to"),

  // Optional link to a specific task
  relatedTaskId: uuid("related_task_id").references(() => missionTasks.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Mission Artifacts (produced outputs from tasks) ───

export const missionArtifacts = pgTable("mission_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id")
    .references(() => missions.id, { onDelete: "cascade" })
    .notNull(),
  taskId: uuid("task_id").references(() => missionTasks.id, {
    onDelete: "set null",
  }),
  producedBy: uuid("produced_by")
    .references(() => aiEmployees.id)
    .notNull(),
  type: text("type").notNull(), // text/data_table/chart/image/video_script/report/publish_plan
  title: text("title").notNull(),
  content: text("content"),
  fileUrl: text("file_url"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─── Relations ───

export const missionsRelations = relations(missions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [missions.organizationId],
    references: [organizations.id],
  }),
  leader: one(aiEmployees, {
    fields: [missions.leaderEmployeeId],
    references: [aiEmployees.id],
  }),
  tasks: many(missionTasks),
  messages: many(missionMessages),
  artifacts: many(missionArtifacts),
}));

export const missionTasksRelations = relations(missionTasks, ({ one }) => ({
  mission: one(missions, {
    fields: [missionTasks.missionId],
    references: [missions.id],
  }),
  assignedEmployee: one(aiEmployees, {
    fields: [missionTasks.assignedEmployeeId],
    references: [aiEmployees.id],
  }),
}));

export const missionArtifactsRelations = relations(
  missionArtifacts,
  ({ one }) => ({
    mission: one(missions, {
      fields: [missionArtifacts.missionId],
      references: [missions.id],
    }),
    task: one(missionTasks, {
      fields: [missionArtifacts.taskId],
      references: [missionTasks.id],
    }),
    producer: one(aiEmployees, {
      fields: [missionArtifacts.producedBy],
      references: [aiEmployees.id],
    }),
  })
);

export const missionMessagesRelations = relations(
  missionMessages,
  ({ one }) => ({
    mission: one(missions, {
      fields: [missionMessages.missionId],
      references: [missions.id],
    }),
    fromEmployee: one(aiEmployees, {
      fields: [missionMessages.fromEmployeeId],
      references: [aiEmployees.id],
      relationName: "sentMessages",
    }),
    toEmployee: one(aiEmployees, {
      fields: [missionMessages.toEmployeeId],
      references: [aiEmployees.id],
      relationName: "receivedMessages",
    }),
    relatedTask: one(missionTasks, {
      fields: [missionMessages.relatedTaskId],
      references: [missionTasks.id],
    }),
  })
);
