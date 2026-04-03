import {
  pgTable,
  uuid,
  text,
  timestamp,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import { missionTasks } from "./missions";
import { memoryTypeEnum } from "./enums";

export const employeeMemories = pgTable("employee_memories", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .references(() => aiEmployees.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  memoryType: memoryTypeEnum("memory_type").notNull(),
  content: text("content").notNull(),
  source: text("source"),
  importance: real("importance").notNull().default(0.5),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),

  sourceTaskId: uuid("source_task_id"),  // no FK constraint to avoid circular deps
  confidence: real("confidence").notNull().default(1.0),
  decayRate: real("decay_rate").notNull().default(0.01),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const employeeMemoriesRelations = relations(
  employeeMemories,
  ({ one }) => ({
    employee: one(aiEmployees, {
      fields: [employeeMemories.employeeId],
      references: [aiEmployees.id],
    }),
    organization: one(organizations, {
      fields: [employeeMemories.organizationId],
      references: [organizations.id],
    }),
    sourceTask: one(missionTasks, {
      fields: [employeeMemories.sourceTaskId],
      references: [missionTasks.id],
    }),
  })
);
