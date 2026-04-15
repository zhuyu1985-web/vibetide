// src/db/schema/research/media-outlets.ts
import {
  pgTable, uuid, text, timestamp, boolean, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "../users";
import { cqDistricts } from "./cq-districts";
import { mediaTierEnum, mediaOutletStatusEnum } from "./enums";

export const mediaOutlets = pgTable(
  "research_media_outlets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
    name: text("name").notNull(),
    tier: mediaTierEnum("tier").notNull(),
    province: text("province"),
    districtId: uuid("district_id").references(() => cqDistricts.id),
    industryTag: text("industry_tag"),
    officialUrl: text("official_url"),
    status: mediaOutletStatusEnum("status").notNull().default("active"),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameTierUq: uniqueIndex("research_media_outlets_org_name_tier_uq").on(
      t.organizationId, t.name, t.tier,
    ),
    tierIdx: index("research_media_outlets_tier_idx").on(t.tier),
    districtIdx: index("research_media_outlets_district_idx").on(t.districtId),
  }),
);

export const mediaOutletAliases = pgTable(
  "research_media_outlet_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outletId: uuid("outlet_id").references(() => mediaOutlets.id, { onDelete: "cascade" }).notNull(),
    alias: text("alias").notNull(),
    matchPattern: text("match_pattern").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    outletIdx: index("research_media_outlet_aliases_outlet_idx").on(t.outletId),
    patternIdx: index("research_media_outlet_aliases_pattern_idx").on(t.matchPattern),
  }),
);

export const mediaOutletCrawlConfigs = pgTable(
  "research_media_outlet_crawl_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    outletId: uuid("outlet_id").references(() => mediaOutlets.id, { onDelete: "cascade" }).notNull().unique(),
    listUrlTemplate: text("list_url_template").notNull(),
    articleUrlPattern: text("article_url_pattern"),
    scheduleCron: text("schedule_cron").notNull().default("0 3 * * *"),
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

export const mediaOutletsRelations = relations(mediaOutlets, ({ many, one }) => ({
  aliases: many(mediaOutletAliases),
  crawlConfig: one(mediaOutletCrawlConfigs),
  district: one(cqDistricts, {
    fields: [mediaOutlets.districtId],
    references: [cqDistricts.id],
  }),
}));
