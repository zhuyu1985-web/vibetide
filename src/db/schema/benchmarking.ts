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
  missedTopicPriorityEnum,
  missedTopicTypeEnum,
  missedTopicStatusEnum,
  missedTopicSourceTypeEnum,
  platformCategoryEnum,
  crawlStatusEnum,
  benchmarkAlertPriorityEnum,
  benchmarkAlertTypeEnum,
  benchmarkAlertStatusEnum,
} from "./enums";
import { aiEmployees } from "./ai-employees";
import { articles } from "./articles";

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

export const benchmarkAnalyses = pgTable("benchmark_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  topicTitle: text("topic_title").notNull(),
  category: text("category"),
  mediaScores: jsonb("media_scores")
    .$type<
      {
        media: string;
        isUs: boolean;
        scores: { dimension: string; score: number }[];
        total: number;
        publishTime: string;
      }[]
    >()
    .default([]),
  radarData: jsonb("radar_data")
    .$type<{ dimension: string; us: number; best: number }[]>()
    .default([]),
  improvements: jsonb("improvements").$type<string[]>().default([]),
  aiSummary: jsonb("ai_summary"),
  sourceArticleId: uuid("source_article_id").references(() => articles.id),

  analyzedAt: timestamp("analyzed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const missedTopics = pgTable("missed_topics", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  title: text("title").notNull(),
  priority: missedTopicPriorityEnum("priority").notNull().default("medium"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  competitors: jsonb("competitors").$type<string[]>().default([]),
  heatScore: real("heat_score").default(0),
  category: text("category"),
  type: missedTopicTypeEnum("type").notNull().default("trending"),
  status: missedTopicStatusEnum("status").notNull().default("missed"),
  sourceType: missedTopicSourceTypeEnum("source_type").default("social_hot"),
  sourceUrl: text("source_url"),
  sourcePlatform: text("source_platform"),
  matchedArticleId: uuid("matched_article_id").references(() => articles.id),
  aiSummary: jsonb("ai_summary"),
  pushedAt: timestamp("pushed_at", { withTimezone: true }),
  pushedToSystem: text("pushed_to_system"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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

export const benchmarkAnalysesRelations = relations(
  benchmarkAnalyses,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [benchmarkAnalyses.organizationId],
      references: [organizations.id],
    }),
  })
);

export const missedTopicsRelations = relations(missedTopics, ({ one }) => ({
  organization: one(organizations, {
    fields: [missedTopics.organizationId],
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

export const platformContent = pgTable("platform_content", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  platformId: uuid("platform_id")
    .references(() => monitoredPlatforms.id, { onDelete: "cascade" })
    .notNull(),

  title: text("title").notNull(),
  summary: text("summary"),
  body: text("body"),
  sourceUrl: text("source_url").notNull(),
  author: text("author"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  topics: jsonb("topics").$type<string[]>().default([]),
  category: text("category"),
  sentiment: text("sentiment"),
  importance: real("importance").default(0),
  contentHash: text("content_hash"),
  coverageStatus: text("coverage_status"),
  gapAnalysis: text("gap_analysis"),
  aiInterpretation: text("ai_interpretation"),

  crawledAt: timestamp("crawled_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
});

export const benchmarkAlerts = pgTable("benchmark_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: benchmarkAlertPriorityEnum("priority").notNull().default("medium"),
  type: benchmarkAlertTypeEnum("type").notNull(),
  status: benchmarkAlertStatusEnum("status").notNull().default("new"),
  platformContentIds: jsonb("platform_content_ids")
    .$type<string[]>()
    .default([]),
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

// Relations for new tables
export const monitoredPlatformsRelations = relations(
  monitoredPlatforms,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [monitoredPlatforms.organizationId],
      references: [organizations.id],
    }),
    content: many(platformContent),
  })
);

export const platformContentRelations = relations(
  platformContent,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [platformContent.organizationId],
      references: [organizations.id],
    }),
    platform: one(monitoredPlatforms, {
      fields: [platformContent.platformId],
      references: [monitoredPlatforms.id],
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
