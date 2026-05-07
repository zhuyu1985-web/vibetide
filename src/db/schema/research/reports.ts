// src/db/schema/research/reports.ts
//
// A5 Phase 1 — researchReports schema
//
// FK onDelete strategy:
//   - organizationId  cascade   (multi-tenant standard: org 删 → report 级联删)
//   - researchTaskId  set null  (任务删后保留报告，研究痕迹不丢)
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
import { researchTasks } from "./research-tasks";

export const researchReports = pgTable(
  "research_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),

    // 来源
    sourceType: text("source_type").notNull(), // "research_task" | "advanced_search"
    researchTaskId: uuid("research_task_id").references(() => researchTasks.id, {
      onDelete: "set null",
    }),
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
    taskIdx: index("research_reports_task_idx").on(t.researchTaskId),
    parentIdx: index("research_reports_parent_idx").on(t.parentReportId),
  }),
);

// === Discriminated union: searchSnapshot ===
//
// 反规范化任务/检索入参 → 任务被删后报告仍可重生（部分数据漂移已在 spec §3.2 处理）。
// 注意：使用类型 import 引用 A4 高级检索的 condition / filter 类型，避免运行时循环依赖。

export type ReportSearchSnapshot =
  | {
      kind: "research_task";
      taskId: string;
      timeRange: { start: string; end: string }; // ISO timestamps
      topicIds: string[];
      districtIds: string[];
      mediaTiers: string[];
      hitItemIds: string[]; // ≤ 500
    }
  | {
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
