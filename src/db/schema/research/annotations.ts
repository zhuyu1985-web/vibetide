// src/db/schema/research/annotations.ts
// A3 Phase 1: research annotation tables — link collected_items to topics/districts
import {
  index, numeric, pgTable, text, timestamp, unique, uuid,
} from "drizzle-orm/pg-core";
import { collectedItems } from "../collection";
import { researchTopics } from "./research-topics";
import { cqDistricts } from "./cq-districts";
import { topicMatchTypeEnum } from "./enums";

export const researchCollectedItemTopics = pgTable(
  "research_collected_item_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectedItemId: uuid("collected_item_id").notNull()
      .references(() => collectedItems.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").notNull()
      .references(() => researchTopics.id, { onDelete: "cascade" }),
    matchType: topicMatchTypeEnum("match_type").notNull(),
    matchedKeyword: text("matched_keyword"),
    matchScore: numeric("match_score", { precision: 5, scale: 4 }),
    annotatedBy: text("annotated_by").notNull().default("system"),
    annotatedAt: timestamp("annotated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueItemTopicMatch: unique("research_cit_unique").on(t.collectedItemId, t.topicId, t.matchType),
    itemIdx: index("research_cit_item_idx").on(t.collectedItemId),
    topicIdx: index("research_cit_topic_idx").on(t.topicId),
  }),
);

export const researchCollectedItemDistricts = pgTable(
  "research_collected_item_districts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectedItemId: uuid("collected_item_id").notNull()
      .references(() => collectedItems.id, { onDelete: "cascade" }),
    districtId: uuid("district_id").notNull()
      .references(() => cqDistricts.id, { onDelete: "cascade" }),
    matchType: topicMatchTypeEnum("match_type").notNull(),
    matchedKeyword: text("matched_keyword"),
    annotatedBy: text("annotated_by").notNull().default("system"),
    annotatedAt: timestamp("annotated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueItemDistrict: unique("research_cid_unique").on(t.collectedItemId, t.districtId),
    itemIdx: index("research_cid_item_idx").on(t.collectedItemId),
    districtIdx: index("research_cid_district_idx").on(t.districtId),
  }),
);

export type ResearchCollectedItemTopicRow = typeof researchCollectedItemTopics.$inferSelect;
export type ResearchCollectedItemDistrictRow = typeof researchCollectedItemDistricts.$inferSelect;
