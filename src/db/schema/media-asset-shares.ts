import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, userProfiles } from "./users";
import { shareStatusEnum } from "./enums";

export const mediaAssetShares = pgTable("media_asset_shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  assetIds: jsonb("asset_ids").$type<string[]>().notNull(),
  createdBy: uuid("created_by")
    .references(() => userProfiles.id)
    .notNull(),

  shareToken: text("share_token").notNull().unique(),
  password: text("password"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxAccessCount: integer("max_access_count"),
  currentAccessCount: integer("current_access_count").notNull().default(0),
  allowDownload: boolean("allow_download").notNull().default(true),

  status: shareStatusEnum("status").notNull().default("active"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const mediaAssetSharesRelations = relations(mediaAssetShares, ({ one }) => ({
  organization: one(organizations, {
    fields: [mediaAssetShares.organizationId],
    references: [organizations.id],
  }),
  creator: one(userProfiles, {
    fields: [mediaAssetShares.createdBy],
    references: [userProfiles.id],
  }),
}));
