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

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  assigneeId: uuid("assignee_id").references(() => aiEmployees.id),
  sessionId: uuid("session_id"), // FK to creation_sessions, nullable

  title: text("title").notNull(),
  description: text("description"),
  mediaType: text("media_type"), // article, video, audio, h5
  status: text("status").notNull().default("pending"), // pending, in_progress, reviewing, approved, published
  priority: text("priority").default("P1"),
  progress: integer("progress").default(0),

  content: jsonb("content").$type<{
    headline: string;
    body: string;
    imageNotes?: string[];
  }>(),

  advisorNotes: jsonb("advisor_notes").$type<string[]>(),
  wordCount: integer("word_count").default(0),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const tasksRelations = relations(tasks, ({ one }) => ({
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  assignee: one(aiEmployees, {
    fields: [tasks.assigneeId],
    references: [aiEmployees.id],
  }),
}));
