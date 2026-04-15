// src/db/schema/research/research-topics.ts
import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../users";
import { researchEmbeddingStatusEnum } from "./enums";

export const researchTopics = pgTable(
  "research_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPreset: boolean("is_preset").notNull().default(false),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgNameUq: uniqueIndex("research_topics_org_name_uq").on(t.organizationId, t.name),
  }),
);

export const researchTopicKeywords = pgTable(
  "research_topic_keywords",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id").references(() => researchTopics.id, { onDelete: "cascade" }).notNull(),
    keyword: text("keyword").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    topicKwUq: uniqueIndex("research_topic_keywords_topic_kw_uq").on(t.topicId, t.keyword),
  }),
);

export const researchTopicSamples = pgTable(
  "research_topic_samples",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id").references(() => researchTopics.id, { onDelete: "cascade" }).notNull(),
    sampleText: text("sample_text").notNull(),
    embedding: jsonb("embedding"),
    embeddingStatus: researchEmbeddingStatusEnum("embedding_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    topicIdx: index("research_topic_samples_topic_idx").on(t.topicId),
  }),
);

export const researchTopicsRelations = relations(researchTopics, ({ many }) => ({
  keywords: many(researchTopicKeywords),
  samples: many(researchTopicSamples),
}));
