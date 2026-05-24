import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { collectedItems } from "./collection";
import {
  accountSourceEnum,
  accountReportTypeEnum,
  accountReportStatusEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// account_daily_snapshots — 账号 × 日期粒度聚合（cron 落盘）
// ---------------------------------------------------------------------------
// 每天 06:00 Asia/Shanghai 跑一次，遍历所有启用账号，把当天 collected_items
// 的互动指标汇总到这张表。报告生成器读这张表展示 KPI / 趋势。
//
// account_id 没有 FK 约束 —— my_accounts 和 benchmark_accounts 是两张表，
// 用 account_source enum 区分；应用层负责完整性。

export const accountDailySnapshots = pgTable(
  "account_daily_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    accountId: uuid("account_id").notNull(),
    accountSource: accountSourceEnum("account_source").notNull(),
    platform: text("platform").notNull(),

    snapshotDate: date("snapshot_date").notNull(),

    postCount: integer("post_count").notNull().default(0),
    totalLikes: integer("total_likes").notNull().default(0),
    totalComments: integer("total_comments").notNull().default(0),
    totalShares: integer("total_shares").notNull().default(0),
    totalViews: integer("total_views").notNull().default(0),
    totalFavorites: integer("total_favorites").notNull().default(0),

    compositeScoreTotal: real("composite_score_total").notNull().default(0),
    compositeScoreAvg: real("composite_score_avg").notNull().default(0),

    /** 当日得分 Top1 的 collected_item id（关联到主表） */
    topPostId: uuid("top_post_id").references(() => collectedItems.id, {
      onDelete: "set null",
    }),

    /** 原始指标快照，供回放 */
    rawMetrics: jsonb("raw_metrics"),

    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uqAccountDate: unique("account_daily_snapshots_acc_date_uniq").on(
      t.organizationId,
      t.accountId,
      t.snapshotDate,
    ),
    orgDateIdx: index("idx_account_daily_snapshots_org_date").on(
      t.organizationId,
      t.snapshotDate,
    ),
    accountDateIdx: index("idx_account_daily_snapshots_account_date").on(
      t.accountId,
      t.snapshotDate,
    ),
  }),
);

// ---------------------------------------------------------------------------
// account_analytics_reports — 报告实例（一份对齐 HTML 样张的完整报告）
// ---------------------------------------------------------------------------

export const accountAnalyticsReports = pgTable(
  "account_analytics_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    accountId: uuid("account_id").notNull(),
    accountSource: accountSourceEnum("account_source").notNull(),
    accountNameSnapshot: text("account_name_snapshot").notNull(),
    platform: text("platform").notNull(),

    reportType: accountReportTypeEnum("report_type").notNull().default("daily"),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    status: accountReportStatusEnum("status").notNull().default("pending"),

    /** Chapter 01 KPI 卡片用 */
    kpis: jsonb("kpis")
      .$type<{
        videos: number;
        likes: number;
        comments: number;
        favorites: number;
        shares: number;
      }>()
      .notNull()
      .default({
        videos: 0,
        likes: 0,
        comments: 0,
        favorites: 0,
        shares: 0,
      }),

    /** Chapter 02 Top N 内容 id 数组（按 rank 排序） */
    topPostIds: jsonb("top_post_ids").$type<string[]>().notNull().default([]),

    /** Chapter 03 共性规律（6 条） */
    patterns: jsonb("patterns")
      .$type<Array<{ dimension: string; rule: string }>>()
      .notNull()
      .default([]),

    /** Chapter 04 运营建议（5 条） */
    recommendations: jsonb("recommendations")
      .$type<Array<{ title: string; body: string }>>()
      .notNull()
      .default([]),

    /** Cover 一句话摘要 */
    executiveSummary: text("executive_summary"),

    /** 生成时的得分公式权重快照，便于复盘 */
    compositeScoreFormulaSnapshot: jsonb("composite_score_formula_snapshot")
      .$type<{
        like: number;
        comment: number;
        share: number;
        favorite: number;
        view: number;
      }>(),

    generatedAt: timestamp("generated_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uqAccountPeriod: unique("account_reports_acc_period_type_uniq").on(
      t.organizationId,
      t.accountId,
      t.periodStart,
      t.periodEnd,
      t.reportType,
    ),
    orgGeneratedIdx: index("idx_account_reports_org_generated").on(
      t.organizationId,
      t.generatedAt,
    ),
    accountGeneratedIdx: index("idx_account_reports_account_generated").on(
      t.accountId,
      t.generatedAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// viral_content_attributions — Top N 爆款逐条归因（LLM 输出落盘）
// ---------------------------------------------------------------------------

export const viralContentAttributions = pgTable(
  "viral_content_attributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => accountAnalyticsReports.id, { onDelete: "cascade" }),
    collectedItemId: uuid("collected_item_id")
      .notNull()
      .references(() => collectedItems.id, { onDelete: "cascade" }),

    rank: integer("rank").notNull(),
    compositeScore: real("composite_score").notNull().default(0),

    /** 2-3 个核心标签（如 反转结构 / 利他转发 / 亲子温情） */
    primaryTags: jsonb("primary_tags").$type<string[]>().notNull().default([]),
    /** 0-3 个辅助标签 */
    secondaryTags: jsonb("secondary_tags").$type<string[]>().notNull().default([]),

    /** 一句话核心爆点（rank-card 标题下方展示） */
    whyViralSummary: text("why_viral_summary").notNull(),
    /** 详细分析 markdown（300-500 字） */
    attributionMarkdown: text("attribution_markdown").notNull(),

    /** 各维度 0-100 打分 */
    dimensionBreakdown: jsonb("dimension_breakdown")
      .$type<{
        topicScore: number;
        emotionScore: number;
        structureScore: number;
        timingScore: number;
        interactionScore: number;
      }>(),

    aiModelUsed: text("ai_model_used"),
    aiPromptVersion: text("ai_prompt_version"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uqReportRank: unique("viral_attributions_report_rank_uniq").on(
      t.reportId,
      t.rank,
    ),
    reportIdx: index("idx_viral_attributions_report").on(t.reportId),
    itemIdx: index("idx_viral_attributions_item").on(t.collectedItemId),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const accountDailySnapshotsRelations = relations(
  accountDailySnapshots,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [accountDailySnapshots.organizationId],
      references: [organizations.id],
    }),
    topPost: one(collectedItems, {
      fields: [accountDailySnapshots.topPostId],
      references: [collectedItems.id],
    }),
  }),
);

export const accountAnalyticsReportsRelations = relations(
  accountAnalyticsReports,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [accountAnalyticsReports.organizationId],
      references: [organizations.id],
    }),
    attributions: many(viralContentAttributions),
  }),
);

export const viralContentAttributionsRelations = relations(
  viralContentAttributions,
  ({ one }) => ({
    report: one(accountAnalyticsReports, {
      fields: [viralContentAttributions.reportId],
      references: [accountAnalyticsReports.id],
    }),
    item: one(collectedItems, {
      fields: [viralContentAttributions.collectedItemId],
      references: [collectedItems.id],
    }),
  }),
);
