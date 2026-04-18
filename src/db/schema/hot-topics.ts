import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import { collectedItems } from "./collection";
import {
  topicPriorityEnum,
  topicTrendEnum,
  topicAngleStatusEnum,
} from "./enums";

export const hotTopics = pgTable("hot_topics", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  title: text("title").notNull(),
  priority: topicPriorityEnum("priority").notNull().default("P1"),
  heatScore: real("heat_score").notNull().default(0),
  trend: topicTrendEnum("trend").notNull().default("rising"),
  source: text("source"),
  category: text("category"),
  summary: text("summary"),
  titleHash: text("title_hash"),
  sourceUrl: text("source_url"),

  aiScore: real("ai_score"),

  heatCurve: jsonb("heat_curve")
    .$type<{ time: string; value: number }[]>()
    .default([]),
  platforms: jsonb("platforms").$type<string[]>().default([]),

  enrichedOutlines: jsonb("enriched_outlines")
    .$type<
      Array<{
        angle: string;
        points: string[];
        wordCount: string;
        style: string;
      }>
    >()
    .default([]),
  relatedMaterials: jsonb("related_materials")
    .$type<
      Array<{
        type: "report" | "data" | "comment";
        title: string;
        source: string;
        url?: string;
        snippet: string;
      }>
    >()
    .default([]),

  collectedItemId: uuid("collected_item_id").references(() => collectedItems.id, {
    onDelete: "set null",
  }),

  discoveredAt: timestamp("discovered_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  uniqueIndex("hot_topics_org_title_hash_uniq").on(table.organizationId, table.titleHash),
  index("hot_topics_collected_item_idx").on(table.collectedItemId),
]);

export const topicAngles = pgTable("topic_angles", {
  id: uuid("id").defaultRandom().primaryKey(),
  hotTopicId: uuid("hot_topic_id")
    .references(() => hotTopics.id, { onDelete: "cascade" })
    .notNull(),

  angleText: text("angle_text").notNull(),
  generatedBy: uuid("generated_by").references(() => aiEmployees.id),
  status: topicAngleStatusEnum("status").notNull().default("suggested"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const competitorResponses = pgTable("competitor_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  hotTopicId: uuid("hot_topic_id")
    .references(() => hotTopics.id, { onDelete: "cascade" })
    .notNull(),

  competitorName: text("competitor_name").notNull(),
  responseType: text("response_type"),
  responseTime: text("response_time"),
  contentUrl: text("content_url"),
  views: text("views"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const commentInsights = pgTable("comment_insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  hotTopicId: uuid("hot_topic_id")
    .references(() => hotTopics.id, { onDelete: "cascade" })
    .notNull(),

  positive: real("positive").notNull().default(0),
  neutral: real("neutral").notNull().default(0),
  negative: real("negative").notNull().default(0),
  hotComments: jsonb("hot_comments").$type<string[]>().default([]),

  analyzedAt: timestamp("analyzed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const hotTopicsRelations = relations(hotTopics, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [hotTopics.organizationId],
    references: [organizations.id],
  }),
  angles: many(topicAngles),
  competitorResponses: many(competitorResponses),
  commentInsights: many(commentInsights),
}));

export const topicAnglesRelations = relations(topicAngles, ({ one }) => ({
  hotTopic: one(hotTopics, {
    fields: [topicAngles.hotTopicId],
    references: [hotTopics.id],
  }),
  generatedByEmployee: one(aiEmployees, {
    fields: [topicAngles.generatedBy],
    references: [aiEmployees.id],
  }),
}));

export const competitorResponsesRelations = relations(
  competitorResponses,
  ({ one }) => ({
    hotTopic: one(hotTopics, {
      fields: [competitorResponses.hotTopicId],
      references: [hotTopics.id],
    }),
  })
);

export const commentInsightsRelations = relations(
  commentInsights,
  ({ one }) => ({
    hotTopic: one(hotTopics, {
      fields: [commentInsights.hotTopicId],
      references: [hotTopics.id],
    }),
  })
);
