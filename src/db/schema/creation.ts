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
import { tasks } from "./tasks";
import {
  creationSessionStatusEnum,
  editorTypeEnum,
  creationChatRoleEnum,
} from "./enums";

export const creationSessions = pgTable("creation_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  teamId: uuid("team_id").references(() => teams.id),

  goalTitle: text("goal_title").notNull(),
  goalDescription: text("goal_description"),
  mediaTypes: jsonb("media_types").$type<string[]>().default([]),
  status: creationSessionStatusEnum("status").notNull().default("active"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const contentVersions = pgTable("content_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),

  versionNumber: integer("version_number").notNull().default(1),
  headline: text("headline"),
  body: text("body"),
  wordCount: integer("word_count").default(0),
  editorType: editorTypeEnum("editor_type").notNull().default("ai"),
  changeSummary: text("change_summary"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const creationChatMessages = pgTable("creation_chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .references(() => creationSessions.id, { onDelete: "cascade" })
    .notNull(),

  role: creationChatRoleEnum("role").notNull(),
  employeeId: uuid("employee_id").references(() => aiEmployees.id),
  content: text("content").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const creationSessionsRelations = relations(
  creationSessions,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [creationSessions.organizationId],
      references: [organizations.id],
    }),
    team: one(teams, {
      fields: [creationSessions.teamId],
      references: [teams.id],
    }),
    chatMessages: many(creationChatMessages),
  })
);

export const contentVersionsRelations = relations(
  contentVersions,
  ({ one }) => ({
    task: one(tasks, {
      fields: [contentVersions.taskId],
      references: [tasks.id],
    }),
  })
);

export const creationChatMessagesRelations = relations(
  creationChatMessages,
  ({ one }) => ({
    session: one(creationSessions, {
      fields: [creationChatMessages.sessionId],
      references: [creationSessions.id],
    }),
    employee: one(aiEmployees, {
      fields: [creationChatMessages.employeeId],
      references: [aiEmployees.id],
    }),
  })
);
