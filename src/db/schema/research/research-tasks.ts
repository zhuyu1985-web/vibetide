// src/db/schema/research/research-tasks.ts
import { pgTable, uuid, text, timestamp, boolean, jsonb, numeric, index } from "drizzle-orm/pg-core";
import { organizations } from "../users";
import { researchTaskStatusEnum, researchDedupLevelEnum } from "./enums";

export const researchTasks = pgTable(
  "research_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    timeRangeStart: timestamp("time_range_start", { withTimezone: true }).notNull(),
    timeRangeEnd: timestamp("time_range_end", { withTimezone: true }).notNull(),
    topicIds: jsonb("topic_ids").$type<string[]>().notNull(),
    districtIds: jsonb("district_ids").$type<string[]>().notNull(),
    mediaTiers: jsonb("media_tiers").$type<string[]>().notNull(),
    customUrls: jsonb("custom_urls").$type<string[]>().notNull().default([]),
    semanticEnabled: boolean("semantic_enabled").notNull().default(true),
    semanticThreshold: numeric("semantic_threshold", { precision: 4, scale: 3 }).notNull().default("0.720"),
    dedupLevel: researchDedupLevelEnum("dedup_level").notNull().default("district"),
    status: researchTaskStatusEnum("status").notNull().default("pending"),
    progress: jsonb("progress").$type<{
      crawled?: number;
      analyzed?: number;
      total?: number;
    }>().notNull().default({}),
    resultSummary: jsonb("result_summary"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    orgUserIdx: index("research_tasks_org_user_idx").on(t.organizationId, t.userId),
    statusIdx: index("research_tasks_status_idx").on(t.status),
  }),
);
