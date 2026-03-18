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
import {
  batchJobStatusEnum,
  batchItemStatusEnum,
  conversionTaskStatusEnum,
} from "./enums";

export const batchJobs = pgTable("batch_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  goalDescription: text("goal_description").notNull(),
  totalItems: integer("total_items").notNull().default(0),
  completedItems: integer("completed_items").notNull().default(0),
  status: batchJobStatusEnum("status").notNull().default("pending"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const batchItems = pgTable("batch_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchJobId: uuid("batch_job_id")
    .references(() => batchJobs.id, { onDelete: "cascade" })
    .notNull(),

  topicTitle: text("topic_title").notNull(),
  channel: text("channel"),
  format: text("format"),
  status: batchItemStatusEnum("status").notNull().default("pending"),
  outputUrl: text("output_url"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const conversionTasks = pgTable("conversion_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  sourceRatio: text("source_ratio").notNull(),
  targetRatio: text("target_ratio").notNull(),
  settings: jsonb("settings")
    .$type<Record<string, unknown>>()
    .default({}),
  status: conversionTaskStatusEnum("status").notNull().default("pending"),
  batchItemId: uuid("batch_item_id").references(() => batchItems.id),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const batchJobsRelations = relations(batchJobs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [batchJobs.organizationId],
    references: [organizations.id],
  }),
  items: many(batchItems),
}));

export const batchItemsRelations = relations(batchItems, ({ one }) => ({
  batchJob: one(batchJobs, {
    fields: [batchItems.batchJobId],
    references: [batchJobs.id],
  }),
}));

export const conversionTasksRelations = relations(
  conversionTasks,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [conversionTasks.organizationId],
      references: [organizations.id],
    }),
    batchItem: one(batchItems, {
      fields: [conversionTasks.batchItemId],
      references: [batchItems.id],
    }),
  })
);
