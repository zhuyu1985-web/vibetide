import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { cmsCatalogs } from "./cms-mapping";
import { reviewTierEnum } from "./enums";

/**
 * APP 栏目 ↔ CMS 栏目绑定（运营配置）。
 *
 * 设计文档 §2.0.1 / §9.3 / §11.2
 *
 * 9 个固定 slug（见 §2.0.1）：app_home / app_news / app_politics / app_sports /
 *   app_variety / app_livelihood_zhongcao / app_livelihood_tandian /
 *   app_livelihood_podcast / app_drama
 */
export const appChannels = pgTable(
  "app_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    reviewTier: reviewTierEnum("review_tier").notNull().default("relaxed"),
    defaultCatalogId: uuid("default_catalog_id").references(() => cmsCatalogs.id),
    defaultListStyle: jsonb("default_list_style").$type<{
      listStyleType?: string;
      listStyleName?: string;
      imageUrlList?: string[];
    }>(),
    defaultCoverUrl: text("default_cover_url"),
    icon: text("icon"),
    sortOrder: integer("sort_order").default(0),
    isEnabled: boolean("is_enabled").default(true),
    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgSlug: uniqueIndex("app_channels_org_slug_uniq").on(
      table.organizationId,
      table.slug,
    ),
  }),
);

export const appChannelsRelations = relations(appChannels, ({ one }) => ({
  organization: one(organizations, {
    fields: [appChannels.organizationId],
    references: [organizations.id],
  }),
  defaultCatalog: one(cmsCatalogs, {
    fields: [appChannels.defaultCatalogId],
    references: [cmsCatalogs.id],
  }),
}));
