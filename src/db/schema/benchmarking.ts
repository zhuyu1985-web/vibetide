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
} from "./enums";

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
