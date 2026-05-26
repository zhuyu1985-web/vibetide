// src/db/schema/research/media-scopes.ts
//
// 生态文明传播指数报告模块 - 媒体名单 schema
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §4.1.1 + §4.1.2
//
// research_media_scopes(主表) + research_media_scope_units(子表)
// 一个 scope 是一份"统计范围"快照(94 单位),units 通过 cascade delete 一并清理
//
// 关键约束:
// - (organizationId, name) 唯一 (同 org 不重名)
// - 每 org 仅允许 1 个 isDefault=true (业务层强制)
// - (scopeId, xlsxRow) 唯一 (同名单不重复)

import {
  pgTable, pgEnum, uuid, text, integer, boolean, timestamp,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations, userProfiles } from "../users";

/**
 * 媒体名单一级 tier 枚举
 * - central: 中央媒体 (45% 权重)
 * - industry: 行业媒体 (25% 权重)
 * - municipal: 市级媒体 (15% 权重)
 * - district_rmt: 区县融媒 (8% 权重的一半)
 * - district_gov: 区县政务/生态环境局类 (8% 权重的一半)
 */
export const scopeUnitTierEnum = pgEnum("scope_unit_tier", [
  "central", "industry", "municipal", "district_rmt", "district_gov",
]);

/**
 * 媒体名单版本表
 */
export const researchMediaScopes = pgTable(
  "research_media_scopes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sourceFileName: text("source_file_name"),
    sourceFileUrl: text("source_file_url"),
    totalUnits: integer("total_units").notNull(),
    centralCount: integer("central_count").notNull().default(0),
    industryCount: integer("industry_count").notNull().default(0),
    municipalCount: integer("municipal_count").notNull().default(0),
    districtRmtCount: integer("district_rmt_count").notNull().default(0),
    districtGovCount: integer("district_gov_count").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by")
      .references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("research_media_scopes_org_idx").on(t.organizationId, t.isDefault),
    orgNameUnique: uniqueIndex("research_media_scopes_org_name_uniq").on(t.organizationId, t.name),
  }),
);

/**
 * 名单单位明细
 * scopeId+xlsxRow 唯一,可追溯到上传文件的行号。
 * resolvedOutletIds 缓存 matcher 反查结果。
 */
export const researchMediaScopeUnits = pgTable(
  "research_media_scope_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeId: uuid("scope_id")
      .references(() => researchMediaScopes.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    displayName: text("display_name"),
    tier: scopeUnitTierEnum("tier").notNull(),
    districtNormalized: text("district_normalized"),
    districtOrig: text("district_orig"),
    websites: text("websites").array().notNull().default(sql`'{}'::text[]`),
    wechatNames: text("wechat_names").array().notNull().default(sql`'{}'::text[]`),
    wechatGhid: text("wechat_ghid"),
    weiboUid: text("weibo_uid"),
    weiboHandle: text("weibo_handle"),
    douyinUrl: text("douyin_url"),
    kuaishouUrl: text("kuaishou_url"),
    xlsxRow: integer("xlsx_row").notNull(),
    resolvedOutletIds: uuid("resolved_outlet_ids").array().notNull().default(sql`'{}'::uuid[]`),
    matchedItemCount2025: integer("matched_item_count_2025").default(0),
    notes: text("notes"),
  },
  (t) => ({
    scopeIdx: index("research_media_scope_units_scope_idx").on(t.scopeId, t.tier),
    scopeRowUnique: uniqueIndex("research_media_scope_units_scope_row_uniq").on(t.scopeId, t.xlsxRow),
  }),
);

export type MediaScope = typeof researchMediaScopes.$inferSelect;
export type MediaScopeInsert = typeof researchMediaScopes.$inferInsert;
export type MediaScopeUnit = typeof researchMediaScopeUnits.$inferSelect;
export type MediaScopeUnitInsert = typeof researchMediaScopeUnits.$inferInsert;
