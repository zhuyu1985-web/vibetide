import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, userProfiles } from "./users";
import { mediaAssets } from "./media-assets";
import {
  reviveScenarioEnum,
  reviveStatusEnum,
  adaptationStatusEnum,
} from "./enums";

export const reviveRecommendations = pgTable("revive_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  assetId: uuid("asset_id")
    .references(() => mediaAssets.id)
    .notNull(),

  scenario: reviveScenarioEnum("scenario").notNull(),
  matchedTopic: text("matched_topic"),
  reason: text("reason"),
  matchScore: real("match_score").notNull().default(0),
  suggestedAction: text("suggested_action"),
  estimatedReach: text("estimated_reach"),

  status: reviveStatusEnum("status").notNull().default("pending"),
  adoptedBy: uuid("adopted_by").references(() => userProfiles.id),
  respondedAt: timestamp("responded_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const reviveRecords = pgTable("revive_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  recommendationId: uuid("recommendation_id").references(
    () => reviveRecommendations.id
  ),
  assetId: uuid("asset_id")
    .references(() => mediaAssets.id)
    .notNull(),

  scenario: reviveScenarioEnum("scenario").notNull(),
  resultReach: integer("result_reach"),
  createdContentId: uuid("created_content_id"),

  summary: text("summary"),
  status: text("status").default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const styleAdaptations = pgTable("style_adaptations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  sourceAssetId: uuid("source_asset_id")
    .references(() => mediaAssets.id)
    .notNull(),

  style: text("style").notNull(),
  styleLabel: text("style_label"),
  generatedTitle: text("generated_title"),
  generatedExcerpt: text("generated_excerpt"),
  tone: text("tone"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const internationalAdaptations = pgTable("international_adaptations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  sourceAssetId: uuid("source_asset_id")
    .references(() => mediaAssets.id)
    .notNull(),

  language: text("language").notNull(),
  languageCode: text("language_code").notNull(),
  flag: text("flag"),
  generatedTitle: text("generated_title"),
  generatedExcerpt: text("generated_excerpt"),
  adaptationNotes: text("adaptation_notes"),

  status: adaptationStatusEnum("status").notNull().default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// Relations
export const reviveRecommendationsRelations = relations(
  reviveRecommendations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [reviveRecommendations.organizationId],
      references: [organizations.id],
    }),
    asset: one(mediaAssets, {
      fields: [reviveRecommendations.assetId],
      references: [mediaAssets.id],
    }),
    adopter: one(userProfiles, {
      fields: [reviveRecommendations.adoptedBy],
      references: [userProfiles.id],
    }),
  })
);

export const reviveRecordsRelations = relations(reviveRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [reviveRecords.organizationId],
    references: [organizations.id],
  }),
  recommendation: one(reviveRecommendations, {
    fields: [reviveRecords.recommendationId],
    references: [reviveRecommendations.id],
  }),
  asset: one(mediaAssets, {
    fields: [reviveRecords.assetId],
    references: [mediaAssets.id],
  }),
}));

export const styleAdaptationsRelations = relations(
  styleAdaptations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [styleAdaptations.organizationId],
      references: [organizations.id],
    }),
    sourceAsset: one(mediaAssets, {
      fields: [styleAdaptations.sourceAssetId],
      references: [mediaAssets.id],
    }),
  })
);

export const internationalAdaptationsRelations = relations(
  internationalAdaptations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [internationalAdaptations.organizationId],
      references: [organizations.id],
    }),
    sourceAsset: one(mediaAssets, {
      fields: [internationalAdaptations.sourceAssetId],
      references: [mediaAssets.id],
    }),
  })
);
