import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, userProfiles } from "./users";
import { categories } from "./categories";
import { aiEmployees } from "./ai-employees";
import { teams } from "./teams";
import { tasks } from "./tasks";
import { workflowInstances } from "./workflows";
import { mediaAssets } from "./media-assets";
import { articleStatusEnum } from "./enums";

export const articles = pgTable("articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  title: text("title").notNull(),
  subtitle: text("subtitle"),
  slug: text("slug"),
  body: text("body"),
  summary: text("summary"),

  content: jsonb("content").$type<{
    headline: string;
    body: string;
    imageNotes?: string[];
    blocks?: unknown[];
  }>(),

  mediaType: text("media_type").notNull().default("article"),
  status: articleStatusEnum("status").notNull().default("draft"),
  priority: text("priority").default("P1"),

  categoryId: uuid("category_id").references(() => categories.id),
  assigneeId: uuid("assignee_id").references(() => aiEmployees.id),
  teamId: uuid("team_id").references(() => teams.id),
  createdBy: uuid("created_by").references(() => userProfiles.id),

  advisorNotes: jsonb("advisor_notes").$type<string[]>(),
  tags: jsonb("tags").$type<string[]>().default([]),
  wordCount: integer("word_count").default(0),
  version: integer("version").default(1),

  publishedAt: timestamp("published_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  taskId: uuid("task_id").references(() => tasks.id),
  workflowInstanceId: uuid("workflow_instance_id").references(
    () => workflowInstances.id
  ),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const articleAssets = pgTable("article_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  articleId: uuid("article_id")
    .references(() => articles.id, { onDelete: "cascade" })
    .notNull(),
  assetId: uuid("asset_id")
    .references(() => mediaAssets.id, { onDelete: "cascade" })
    .notNull(),

  usageType: text("usage_type").notNull().default("reference"),
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),

  segmentId: uuid("segment_id"),
  startTime: text("start_time"),
  endTime: text("end_time"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const articlesRelations = relations(articles, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [articles.organizationId],
    references: [organizations.id],
  }),
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  assignee: one(aiEmployees, {
    fields: [articles.assigneeId],
    references: [aiEmployees.id],
  }),
  team: one(teams, {
    fields: [articles.teamId],
    references: [teams.id],
  }),
  creator: one(userProfiles, {
    fields: [articles.createdBy],
    references: [userProfiles.id],
  }),
  task: one(tasks, {
    fields: [articles.taskId],
    references: [tasks.id],
  }),
  workflowInstance: one(workflowInstances, {
    fields: [articles.workflowInstanceId],
    references: [workflowInstances.id],
  }),
  articleAssets: many(articleAssets),
}));

export const articleAssetsRelations = relations(articleAssets, ({ one }) => ({
  article: one(articles, {
    fields: [articleAssets.articleId],
    references: [articles.id],
  }),
  asset: one(mediaAssets, {
    fields: [articleAssets.assetId],
    references: [mediaAssets.id],
  }),
}));
