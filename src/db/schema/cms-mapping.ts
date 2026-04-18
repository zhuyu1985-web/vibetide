import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  uniqueIndex,
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
