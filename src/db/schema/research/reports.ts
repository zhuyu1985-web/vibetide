// src/db/schema/research/reports.ts
//
// A5 Phase 1 — researchReports schema
// 2026-05-13: researchTaskId 列 + research_task source_type 已下线
// (/research/admin/tasks 整体废弃,采集任务统一到 Collection Hub);
// 仅保留 advanced_search 报告路径。
//
// FK onDelete strategy:
//   - organizationId  cascade   (multi-tenant standard: org 删 → report 级联删)
//   - parentReportId  cascade   (self-FK, 母版删 → 快照级联删)
//   - generatedBy     set null  (用户离职后保留报告，仅丢审计署名)

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { organizations, userProfiles } from "../users";

export const researchReports = pgTable(
  "research_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),

    // 来源 — 目前仅有 advanced_search 一种(research_task 已于 2026-05-13 下线)
    sourceType: text("source_type").notNull().default("advanced_search"),
    searchSnapshot: jsonb("search_snapshot").notNull(),

    // 元数据
    title: text("title").notNull(),
    topicDescription: text("topic_description"),

    // 内容
    reportHtml: text("report_html"),
    aggregatesJson: jsonb("aggregates_json"),

    // 文件
    wordFileUrl: text("word_file_url"),
    excelFileUrl: text("excel_file_url"),
    fileExpiresAt: timestamp("file_expires_at", { withTimezone: true }),

    // 快照
    parentReportId: uuid("parent_report_id").references(
      (): AnyPgColumn => researchReports.id,
      { onDelete: "cascade" },
    ),
    isSnapshot: boolean("is_snapshot").notNull().default(false),
    snapshotName: text("snapshot_name"),

    // 状态机
    status: text("status").notNull().default("pending"), // pending/generating/ready/failed
    currentStep: text("current_step"),
    errorMessage: text("error_message"),

    // 审计
    generatedBy: uuid("generated_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    orgIdx: index("research_reports_org_idx").on(t.organizationId, t.createdAt),
    parentIdx: index("research_reports_parent_idx").on(t.parentReportId),
  }),
);

// === Discriminated union: searchSnapshot ===
// 仅保留 advanced_search 一种(2026-05-13 起 research_task 已废弃)。
// 类型 import 引用 A4 高级检索的 condition / filter 类型，避免运行时循环依赖。

export type ReportSearchSnapshot = {
  kind: "advanced_search";
  conditions: import("@/app/(dashboard)/research/search-mode-types").AdvancedSearchCondition[];
  sidebarFilter: import("@/app/(dashboard)/research/search-mode-types").SidebarFilter;
  hitItemIds: string[]; // ≤ 500
  capturedAt: string; // ISO timestamp
};

// === aggregatesJson shape ===

export type AggregatesJson = {
  mediaTierDistribution: Array<{
    tier: string;
    count: number;
    percentage: number;
    topMediaNames: string[];
  }>;
  districtDistribution: Array<{
    districtId: string;
    districtName: string;
    count: number;
    percentage: number;
    topTopics: string[];
  }>;
  topicDistribution: Array<{
    topicId: string;
    topicName: string;
    count: number;
    percentage: number;
    topDistricts: string[];
    topMedia: string[];
  }>;
  dailyTrend: Array<{ date: string; count: number; cumulative: number }>;
  crossPivots?: {
    topicByDistrict?: Array<{ topicId: string; districtId: string; count: number }>;
    topicByTier?: Array<{ topicId: string; tier: string; count: number }>;
  };
  hitCount: number;
  isAiFallback: boolean;
  generatedAt: string;
};
