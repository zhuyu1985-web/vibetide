import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, userProfiles } from "./users";
import { categories } from "./categories";
import { mediaAssetTypeEnum, assetProcessingStatusEnum } from "./enums";

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  title: text("title").notNull(),
  type: mediaAssetTypeEnum("type").notNull(),
  description: text("description"),

  fileUrl: text("file_url"),
  thumbnailUrl: text("thumbnail_url"),
  fileName: text("file_name"),
  fileSize: bigint("file_size", { mode: "number" }),
  fileSizeDisplay: text("file_size_display"),
  mimeType: text("mime_type"),
  duration: text("duration"),
  durationSeconds: integer("duration_seconds"),

  source: text("source"),
  sourceId: text("source_id"),
  tags: jsonb("tags").$type<string[]>().default([]),

  understandingStatus: assetProcessingStatusEnum("understanding_status")
    .notNull()
    .default("queued"),
  understandingProgress: integer("understanding_progress").notNull().default(0),
  totalTags: integer("total_tags").notNull().default(0),
  processedAt: timestamp("processed_at", { withTimezone: true }),

  categoryId: uuid("category_id").references(() => categories.id),
  usageCount: integer("usage_count").notNull().default(0),

  uploadedBy: uuid("uploaded_by").references(() => userProfiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const mediaAssetsRelations = relations(mediaAssets, ({ one }) => ({
  organization: one(organizations, {
    fields: [mediaAssets.organizationId],
    references: [organizations.id],
  }),
  category: one(categories, {
    fields: [mediaAssets.categoryId],
    references: [categories.id],
  }),
  uploader: one(userProfiles, {
    fields: [mediaAssets.uploadedBy],
    references: [userProfiles.id],
  }),
}));
