// src/db/schema/research/news-articles.ts
import {
  pgTable, uuid, text, timestamp, jsonb, numeric,
  uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { mediaOutlets } from "./media-outlets";
import { cqDistricts } from "./cq-districts";
import { researchTopics } from "./research-topics";
import { researchTasks } from "./research-tasks";
import {
  mediaTierEnum,
  newsSourceChannelEnum,
  topicMatchTypeEnum,
  researchEmbeddingStatusEnum,
} from "./enums";

export const newsArticles = pgTable(
  "research_news_articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    urlHash: text("url_hash").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    htmlSnapshotPath: text("html_snapshot_path"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    outletId: uuid("outlet_id").references(() => mediaOutlets.id),
    outletTierSnapshot: mediaTierEnum("outlet_tier_snapshot"),
    districtIdSnapshot: uuid("district_id_snapshot").references(() => cqDistricts.id),
    sourceChannel: newsSourceChannelEnum("source_channel").notNull(),
    crawledAt: timestamp("crawled_at", { withTimezone: true }).defaultNow().notNull(),
    embedding: jsonb("embedding"),
    embeddingStatus: researchEmbeddingStatusEnum("embedding_status").notNull().default("pending"),
    rawMetadata: jsonb("raw_metadata"),
  },
  (t) => ({
    urlHashUq: uniqueIndex("research_news_articles_url_hash_uq").on(t.urlHash),
    outletPublishedIdx: index("research_news_articles_outlet_published_idx").on(t.outletId, t.publishedAt),
    districtPublishedIdx: index("research_news_articles_district_published_idx").on(t.districtIdSnapshot, t.publishedAt),
    embeddingStatusIdx: index("research_news_articles_embedding_status_idx").on(t.embeddingStatus),
  }),
);

export const newsArticleTopicHits = pgTable(
  "research_news_article_topic_hits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id").references(() => newsArticles.id, { onDelete: "cascade" }).notNull(),
    topicId: uuid("topic_id").references(() => researchTopics.id, { onDelete: "cascade" }).notNull(),
    researchTaskId: uuid("research_task_id").references(() => researchTasks.id, { onDelete: "cascade" }).notNull(),
    matchType: topicMatchTypeEnum("match_type").notNull(),
    matchedKeywords: jsonb("matched_keywords").$type<string[]>().notNull().default([]),
    matchedFields: jsonb("matched_fields").$type<string[]>().notNull().default([]),
    semanticScore: numeric("semantic_score", { precision: 5, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    articleTopicTaskUq: uniqueIndex("research_news_article_topic_hits_uq").on(
      t.articleId, t.topicId, t.researchTaskId,
    ),
    taskTopicIdx: index("research_news_article_topic_hits_task_topic_idx").on(
      t.researchTaskId, t.topicId,
    ),
  }),
);
