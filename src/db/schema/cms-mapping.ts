import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
  jsonb,
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

// =====================================================================
// cms_catalogs — CMS 栏目扁平化（来自 /web/catalog/getTree）
// =====================================================================

export const cmsCatalogs = pgTable(
  "cms_catalogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    cmsCatalogId: integer("cms_catalog_id").notNull(),
    appId: integer("app_id").notNull(),
    siteId: integer("site_id").notNull(),
    name: text("name").notNull(),
    parentId: integer("parent_id").default(0),
    innerCode: text("inner_code"),
    alias: text("alias"),
    treeLevel: integer("tree_level"),
    isLeaf: boolean("is_leaf").default(true),
    catalogType: integer("catalog_type").default(1), // 1=新闻栏目

    // 播放器 / 预览地址（入稿时可能需要）
    videoPlayer: text("video_player"),
    audioPlayer: text("audio_player"),
    livePlayer: text("live_player"),
    vlivePlayer: text("vlive_player"),
    h5Preview: text("h5_preview"),
    pcPreview: text("pc_preview"),
    url: text("url"),

    // 软删（CMS 侧删除 → 标记 deletedAt 不物理删，保护引用）
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqOrgCatalogId: uniqueIndex("cms_catalogs_org_catid_uniq").on(
      table.organizationId,
      table.cmsCatalogId,
    ),
    treeIdx: index("cms_catalogs_tree_idx").on(
      table.organizationId,
      table.parentId,
      table.deletedAt,
    ),
    appIdx: index("cms_catalogs_app_idx").on(table.organizationId, table.appId),
  }),
);

export const cmsCatalogsRelations = relations(cmsCatalogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsCatalogs.organizationId],
    references: [organizations.id],
  }),
}));

// =====================================================================
// cms_sync_logs — 栏目同步历史
// =====================================================================

export const cmsSyncLogs = pgTable(
  "cms_sync_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    state: text("state").notNull(), // running / done / failed
    stats: jsonb("stats").$type<Record<string, number>>(),
    warnings: jsonb("warnings").$type<string[]>(),
    triggerSource: text("trigger_source"), // manual / scheduled / auto_repair / first_time_setup
    operatorId: text("operator_id"),

    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
  },
  (table) => ({
    orgTimeIdx: index("cms_sync_logs_org_time_idx").on(
      table.organizationId,
      table.startedAt,
    ),
  }),
);

export const cmsSyncLogsRelations = relations(cmsSyncLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsSyncLogs.organizationId],
    references: [organizations.id],
  }),
}));
