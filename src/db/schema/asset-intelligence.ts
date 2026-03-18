import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { mediaAssets } from "./media-assets";
import { userProfiles } from "./users";
import { assetTagCategoryEnum, tagSourceEnum } from "./enums";

export const assetSegments = pgTable("asset_segments", {
  id: uuid("id").defaultRandom().primaryKey(),
  assetId: uuid("asset_id")
    .references(() => mediaAssets.id, { onDelete: "cascade" })
    .notNull(),

  startTime: text("start_time"),
  endTime: text("end_time"),
  startTimeSeconds: real("start_time_seconds"),
  endTimeSeconds: real("end_time_seconds"),

  transcript: text("transcript"),
  ocrTexts: jsonb("ocr_texts").$type<string[]>().default([]),
  nluSummary: text("nlu_summary"),
  sceneType: text("scene_type"),
  visualQuality: real("visual_quality"),

  segmentOrder: integer("segment_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const assetTags = pgTable("asset_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  assetId: uuid("asset_id")
    .references(() => mediaAssets.id, { onDelete: "cascade" })
    .notNull(),
  segmentId: uuid("segment_id").references(() => assetSegments.id, {
    onDelete: "cascade",
  }),

  category: assetTagCategoryEnum("category").notNull(),
  label: text("label").notNull(),
  confidence: real("confidence").notNull().default(0),

  source: tagSourceEnum("source").notNull().default("ai_auto"),
  correctedBy: uuid("corrected_by").references(() => userProfiles.id),
  originalLabel: text("original_label"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const detectedFaces = pgTable("detected_faces", {
  id: uuid("id").defaultRandom().primaryKey(),
  segmentId: uuid("segment_id")
    .references(() => assetSegments.id, { onDelete: "cascade" })
    .notNull(),
  assetId: uuid("asset_id")
    .references(() => mediaAssets.id, { onDelete: "cascade" })
    .notNull(),

  name: text("name").notNull(),
  role: text("role"),
  confidence: real("confidence").notNull().default(0),
  appearances: integer("appearances").default(1),

  boundingBox: jsonb("bounding_box"),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const assetSegmentsRelations = relations(
  assetSegments,
  ({ one, many }) => ({
    asset: one(mediaAssets, {
      fields: [assetSegments.assetId],
      references: [mediaAssets.id],
    }),
    tags: many(assetTags),
    faces: many(detectedFaces),
  })
);

export const assetTagsRelations = relations(assetTags, ({ one }) => ({
  asset: one(mediaAssets, {
    fields: [assetTags.assetId],
    references: [mediaAssets.id],
  }),
  segment: one(assetSegments, {
    fields: [assetTags.segmentId],
    references: [assetSegments.id],
  }),
  corrector: one(userProfiles, {
    fields: [assetTags.correctedBy],
    references: [userProfiles.id],
  }),
}));

export const detectedFacesRelations = relations(detectedFaces, ({ one }) => ({
  segment: one(assetSegments, {
    fields: [detectedFaces.segmentId],
    references: [assetSegments.id],
  }),
  asset: one(mediaAssets, {
    fields: [detectedFaces.assetId],
    references: [mediaAssets.id],
  }),
}));
