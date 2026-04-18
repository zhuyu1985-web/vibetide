import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

// =====================================================================
// cms_channels — CMS 渠道字典（来自 /web/catalog/getChannels）
// 设计文档 §9.3 / §11.2
// Task 7 of Phase 1 CMS Adapter MVP — 本文件后续会追加
// cms_apps / cms_catalogs / cms_sync_logs 等表（Task 8-10）。
// =====================================================================

export const cmsChannels = pgTable(
  "cms_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    channelKey: text("channel_key").notNull(), // CHANNEL_APP / CHANNEL_WECHAT ...
    channelCode: integer("channel_code").notNull(), // 1 / 3 / 5 ...
    name: text("name").notNull(),
    pickValue: text("pick_value"),
    thirdFlag: text("third_flag"),

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqOrgKey: uniqueIndex("cms_channels_org_key_uniq").on(
      table.organizationId,
      table.channelKey,
    ),
  }),
);

export const cmsChannelsRelations = relations(cmsChannels, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsChannels.organizationId],
    references: [organizations.id],
  }),
}));

// =====================================================================
// cms_apps — CMS 应用（来自 /web/application/getAppList）
// 设计文档 §9.3 / §11.2
// Task 8 of Phase 1 CMS Adapter MVP
// =====================================================================

export const cmsApps = pgTable(
  "cms_apps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    channelKey: text("channel_key").notNull(), // CHANNEL_APP / CHANNEL_WEB ...
    cmsAppId: text("cms_app_id").notNull(), // CMS 的 app.id
    siteId: integer("site_id").notNull(),
    name: text("name").notNull(),
    appkey: text("appkey"),
    appsecret: text("appsecret"), // ⚠️ P1 明文存储；Phase 2 接 KMS

    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    uniqOrgAppId: uniqueIndex("cms_apps_org_appid_uniq").on(
      table.organizationId,
      table.cmsAppId,
    ),
    siteIdIdx: index("cms_apps_site_id_idx").on(
      table.organizationId,
      table.siteId,
    ),
  }),
);

export const cmsAppsRelations = relations(cmsApps, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsApps.organizationId],
    references: [organizations.id],
  }),
}));
