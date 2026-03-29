import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  jsonb,
  boolean,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, userProfiles } from "./users";
import { categories } from "./categories";
import {
  mediaAssetTypeEnum,
  assetProcessingStatusEnum,
  libraryTypeEnum,
  securityLevelEnum,
  mediaReviewStatusEnum,
  mediaCatalogStatusEnum,
  mediaTranscodeStatusEnum,
  mediaCdnStatusEnum,
  mediaCmsStatusEnum,
} from "./enums";

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  title: text("title").notNull(),
  type: mediaAssetTypeEnum("type").notNull(),
  description: text("description"),

  // File storage
  fileUrl: text("file_url"),
  thumbnailUrl: text("thumbnail_url"),
  fileName: text("file_name"),
  fileSize: bigint("file_size", { mode: "number" }),
  fileSizeDisplay: text("file_size_display"),
  mimeType: text("mime_type"),
  duration: text("duration"),
  durationSeconds: integer("duration_seconds"),
  width: integer("width"),
  height: integer("height"),

  // TOS (Volcano Engine Object Storage)
  tosObjectKey: text("tos_object_key"),
  tosBucket: text("tos_bucket"),

  source: text("source"),
  sourceId: text("source_id"),
  tags: jsonb("tags").$type<string[]>().default([]),

  // Library & visibility
  libraryType: libraryTypeEnum("library_type").notNull().default("personal"),
  isPublic: boolean("is_public").notNull().default(false),

  // Soft delete (recycle bin)
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by").references(() => userProfiles.id),
  originalCategoryId: uuid("original_category_id"),

  // Status fields
  securityLevel: securityLevelEnum("security_level").notNull().default("public"),
  reviewStatus: mediaReviewStatusEnum("review_status").notNull().default("not_submitted"),
  catalogStatus: mediaCatalogStatusEnum("catalog_status").notNull().default("uncataloged"),
  transcodeStatus: mediaTranscodeStatusEnum("transcode_status").notNull().default("not_started"),
  cdnStatus: mediaCdnStatusEnum("cdn_status").notNull().default("not_started"),
  cmsStatus: mediaCmsStatusEnum("cms_status").notNull().default("not_started"),

  // AI understanding
  understandingStatus: assetProcessingStatusEnum("understanding_status")
    .notNull()
    .default("queued"),
  understandingProgress: integer("understanding_progress").notNull().default(0),
  totalTags: integer("total_tags").notNull().default(0),
  processedAt: timestamp("processed_at", { withTimezone: true }),

  // Version management
  versionNumber: integer("version_number").notNull().default(1),
  parentVersionId: uuid("parent_version_id").references(
    (): AnyPgColumn => mediaAssets.id
  ),

  // Catalog / metadata
  catalogData: jsonb("catalog_data").$type<Record<string, unknown>>(),

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
  parentVersion: one(mediaAssets, {
    fields: [mediaAssets.parentVersionId],
    references: [mediaAssets.id],
    relationName: "assetVersionChain",
  }),
}));
