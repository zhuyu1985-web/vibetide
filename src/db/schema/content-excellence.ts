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

// ---------------------------------------------------------------------------
// case_library — 优秀案例库 (F3.3.02)
// ---------------------------------------------------------------------------

export const caseLibrary = pgTable("case_library", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  contentId: text("content_id").notNull(),
  title: text("title").notNull(),
  channel: text("channel"),
  score: integer("score").notNull(), // 0-100 effect score (>=80 to qualify)

  successFactors: jsonb("success_factors").$type<{
    titleStrategy?: string;
    topicAngle?: string;
    contentStructure?: string;
    emotionalResonance?: string;
  }>(),

  tags: jsonb("tags").$type<string[]>().default([]),

  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// hit_predictions — 爆品指数预测 (F3.3.03)
// ---------------------------------------------------------------------------

export const hitPredictions = pgTable("hit_predictions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  contentId: text("content_id").notNull(),

  predictedScore: integer("predicted_score").notNull(), // 0-100
  actualScore: integer("actual_score"), // filled in after publish + 7d

  dimensions: jsonb("dimensions").$type<{
    titleAppeal?: number;
    topicRelevance?: number;
    contentDepth?: number;
    emotionalHook?: number;
    timingFit?: number;
  }>(),

  suggestions: jsonb("suggestions").$type<{
    area: string;
    current: string;
    recommended: string;
    impact: string;
  }[]>().default([]),

  // Track suggestion adoption (F3.3.05)
  suggestionsAdopted: integer("suggestions_adopted").default(0),
  trackingStartedAt: timestamp("tracking_started_at", { withTimezone: true }),
  trackingCompletedAt: timestamp("tracking_completed_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// competitor_hits — 竞品爆款学习 (F3.3.01)
// ---------------------------------------------------------------------------

export const competitorHits = pgTable("competitor_hits", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  competitorName: text("competitor_name").notNull(),
  title: text("title").notNull(),
  platform: text("platform").notNull(),

  metrics: jsonb("metrics").$type<{
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
  }>(),

  successFactors: jsonb("success_factors").$type<{
    titleStrategy?: string;
    topicAngle?: string;
    contentStructure?: string;
    emotionalResonance?: string;
  }>(),

  analyzedAt: timestamp("analyzed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const caseLibraryRelations = relations(caseLibrary, ({ one }) => ({
  organization: one(organizations, {
    fields: [caseLibrary.organizationId],
    references: [organizations.id],
  }),
}));

export const hitPredictionsRelations = relations(
  hitPredictions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [hitPredictions.organizationId],
      references: [organizations.id],
    }),
  })
);

export const competitorHitsRelations = relations(
  competitorHits,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [competitorHits.organizationId],
      references: [organizations.id],
    }),
  })
);
