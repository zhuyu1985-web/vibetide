// src/db/schema/research/activity-datasets.ts
//
// 生态文明传播指数报告模块 - 线下活动数据集 schema
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §4.1.3
//
// 一份 dataset = 一年活动统计(39 区县 × 5 主题), data jsonb 直存全部明细
//
// 关键约束:
// - (organizationId, name) 唯一
// - 每 org 每年仅允许 1 个 isDefault=true

import {
  pgTable, uuid, text, integer, boolean, timestamp, jsonb,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations, userProfiles } from "../users";

/**
 * 单个区县的活动数据点 (data jsonb 数组的元素)
 *
 * 通常 5 个主题: 六五环境日 / 815全国生态日 / 志愿服务活动 /
 *                环保设施向公众开放 / 美丽重庆六进活动
 */
export type ActivityDataPoint = {
  district: string;       // 标准 39 区县名(已合并江北/渝北→两江)
  themes: Record<string, number>;   // { '六五环境日': 5, '815全国生态日': 1, ... }
  total: number;          // 总场数
  firstDate: string;      // ISO YYYY-MM-DD
  lastDate: string;
  spanDays: number;       // (last - first) 含两端 + 1
  freq: number;           // total / spanDays
};

/**
 * 线下生态宣传活动数据集
 */
export const researchActivityDatasets = pgTable(
  "research_activity_datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    year: integer("year").notNull(),
    sourceFileName: text("source_file_name"),
    sourceFileUrl: text("source_file_url"),
    districtCount: integer("district_count").notNull(),
    totalActivities: integer("total_activities").notNull(),
    activityThemes: text("activity_themes").array().notNull(),
    data: jsonb("data").$type<ActivityDataPoint[]>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdBy: uuid("created_by")
      .references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgYearIdx: index("research_activity_datasets_org_year_idx")
      .on(t.organizationId, t.year, t.isDefault),
    orgNameUnique: uniqueIndex("research_activity_datasets_org_name_uniq")
      .on(t.organizationId, t.name),
  }),
);

export type ActivityDataset = typeof researchActivityDatasets.$inferSelect;
export type ActivityDatasetInsert = typeof researchActivityDatasets.$inferInsert;
