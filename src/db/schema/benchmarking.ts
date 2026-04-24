import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import {
  platformCategoryEnum,
  crawlStatusEnum,
  benchmarkAlertPriorityEnum,
  benchmarkAlertTypeEnum,
  benchmarkAlertStatusEnum,
} from "./enums";
import { aiEmployees } from "./ai-employees";

export const competitors = pgTable("competitors", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: text("name").notNull(),
  platform: text("platform"),
  followers: integer("followers").default(0),
  avgViews: integer("avg_views").default(0),
  publishFreq: text("publish_freq"),
  strengths: jsonb("strengths").$type<string[]>().default([]),
  gaps: jsonb("gaps").$type<string[]>().default([]),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// NOTE (2026-04-21): benchmarkAnalyses / missedTopics / platformContent 已在
// topic-compare v2 重构中 drop 并由 src/db/schema/topic-compare-v2.ts 的新表取代。
// 新的 missedTopics 定义见 topic-compare-v2.ts。

export const weeklyReports = pgTable("weekly_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  period: text("period").notNull(),
  overallScore: real("overall_score").default(0),
  missedRate: real("missed_rate").default(0),
  responseSpeed: text("response_speed"),
  coverageRate: real("coverage_rate").default(0),
  trends: jsonb("trends")
    .$type<{ week: string; score: number; missedRate: number }[]>()
    .default([]),
  gapList: jsonb("gap_list")
    .$type<{ area: string; gap: string; suggestion: string }[]>()
    .default([]),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const competitorsRelations = relations(competitors, ({ one }) => ({
  organization: one(organizations, {
    fields: [competitors.organizationId],
    references: [organizations.id],
  }),
}));

export const weeklyReportsRelations = relations(weeklyReports, ({ one }) => ({
  organization: one(organizations, {
    fields: [weeklyReports.organizationId],
    references: [organizations.id],
  }),
}));

// ---------------------------------------------------------------------------
// Benchmarking Deep-Dive Tables
// ---------------------------------------------------------------------------

export const monitoredPlatforms = pgTable("monitored_platforms", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  name: text("name").notNull(),
  url: text("url").notNull(),
  category: platformCategoryEnum("category").notNull().default("central"),
  province: text("province"),
  crawlFrequencyMinutes: integer("crawl_frequency_minutes").default(1440),
  status: crawlStatusEnum("status").notNull().default("active"),
  crawlConfig: jsonb("crawl_config")
    .$type<{
      rssUrl?: string;
      searchQuery?: string;
      urlPatterns?: string[];
      categories?: string[];
    }>()
    .default({}),
  lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
  lastErrorMessage: text("last_error_message"),
  totalContentCount: integer("total_content_count").default(0),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// platformContent 已在 topic-compare v2 重构中 drop。新的账号维度见 benchmark_posts。

export const benchmarkAlerts = pgTable("benchmark_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: benchmarkAlertPriorityEnum("priority").notNull().default("medium"),
  type: benchmarkAlertTypeEnum("type").notNull(),
  status: benchmarkAlertStatusEnum("status").notNull().default("new"),
  // 原 platformContentIds 已废弃（platform_content 表 drop）。
  // 保留列名以防其他消费者引用；未来可移除。
  platformContentIds: jsonb("platform_content_ids").$type<string[]>().default([]),
  relatedPlatforms: jsonb("related_platforms").$type<string[]>().default([]),
  relatedTopics: jsonb("related_topics").$type<string[]>().default([]),
  analysisData: jsonb("analysis_data")
    .$type<{
      heatScore?: number;
      coverageGap?: string;
      competitorCount?: number;
      suggestedAngle?: string;
      suggestedAction?: string;
      estimatedUrgencyHours?: number;
      sourceExcerpts?: string[];
    }>()
    .default({}),
  actionedBy: uuid("actioned_by"),
  actionNote: text("action_note"),
  workflowInstanceId: uuid("workflow_instance_id"),
  generatedBy: uuid("generated_by").references(() => aiEmployees.id),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations for remaining tables
export const monitoredPlatformsRelations = relations(
  monitoredPlatforms,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [monitoredPlatforms.organizationId],
      references: [organizations.id],
    }),
  })
);

export const benchmarkAlertsRelations = relations(
  benchmarkAlerts,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [benchmarkAlerts.organizationId],
      references: [organizations.id],
    }),
    generator: one(aiEmployees, {
      fields: [benchmarkAlerts.generatedBy],
      references: [aiEmployees.id],
    }),
  })
);
