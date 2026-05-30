/**
 * scheduled_jobs —— 全项目 cron 任务统一配置中心。
 *
 * 设计动机:历史上每个 Inngest 函数把 cron 字符串写死在装饰器里
 *   ({ cron: "0 21 * * *" }),管理员要改频率必须改代码 + 重新部署,无法
 *   在 UI 上 toggle / 调整。
 *
 * 方案:
 *   - 这张表是 SSOT,每条记录 = 一个定时任务的配置(name 唯一 + cron 表达式 +
 *     enabled + 事件名)
 *   - 一个 master scheduler (src/inngest/functions/scheduler/scheduled-jobs-runner.ts)
 *     每分钟跑一次,扫描 enabled jobs,按 cron-parser 判断 next_run_at 是否
 *     到点,到点就派发对应 event,并更新 last_run_at + next_run_at
 *   - 业务 Inngest 函数从订阅 cron 改为订阅 event(`scheduled-jobs/<name>.run`),
 *     这样 cron 表达式可在 DB / UI 上动态修改,无需重启
 *
 * 2026-05-29 扩展 — 新增 kind 字段区分两类 job:
 *   - kind='platform':原有 13 条平台级 cron(无 organization_id,eventName 写死)
 *   - kind='workflow_template':运营在 /workflows/[id] 定时任务 tab 上配置的
 *     "按场景定时启动 mission",organization_id + workflow_template_id 必填,
 *     payload 承载 inputParams,runner 派发统一的 typed event
 *     `scheduled-jobs/workflow-template.run`。
 */
import {
  boolean,
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";
import { workflowTemplates } from "./workflows";
import { scheduledJobKindEnum } from "./enums";

export const scheduledJobs = pgTable("scheduled_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),

  /** 任务唯一标识,kebab-case,如 "account-analytics-crawl"。同时用于 event 名前缀 */
  name: text("name").notNull().unique(),

  /** 中文显示名,如 "账号分析 · 自动抓取" */
  displayName: text("display_name").notNull(),

  /** 任务说明,用于 UI tooltip */
  description: text("description"),

  /**
   * 派发的 Inngest 事件名 —— 业务函数订阅这个事件而不是 cron。
   * - kind='platform':约定 `scheduled-jobs/<name>.run`
   * - kind='workflow_template':runner 忽略此列,统一派 `scheduled-jobs/workflow-template.run`
   *   (允许写任意值占位,推荐写 `scheduled-jobs/workflow-template.run` 保持一致)
   */
  eventName: text("event_name").notNull(),

  /** 标准 cron 5 字段表达式(分 时 日 月 周),如 "0 21 * * *" */
  cronExpression: text("cron_expression").notNull(),

  /** 时区,默认 Asia/Shanghai。cron-parser 按此时区解析 */
  timezone: text("timezone").notNull().default("Asia/Shanghai"),

  /** 是否启用 —— scheduler 只调度 enabled=true 的 job */
  enabled: boolean("enabled").notNull().default(true),

  /** 分类标签,用于 UI 分组,如 "account-analytics" / "cms" / "collection" */
  category: text("category").notNull().default("misc"),

  // ─── 2026-05-29 新增:支持 per-workflow-template per-org schedule ───

  /**
   * Job 类型:platform = 平台级 cron(向后兼容);workflow_template = 按场景模板的 schedule
   * 默认 platform 保留 13 条旧行的行为完全不变
   */
  kind: scheduledJobKindEnum("kind").notNull().default("platform"),

  /**
   * 所属组织(多租户隔离)。kind='platform' 时必须为 NULL;
   * kind='workflow_template' 时必须非 NULL。
   */
  organizationId: uuid("organization_id").references(() => organizations.id),

  /**
   * 关联的 workflow_template。kind='platform' 时为 NULL;
   * kind='workflow_template' 时必须非 NULL,指向 workflow_templates.id。
   */
  workflowTemplateId: uuid("workflow_template_id").references(() => workflowTemplates.id),

  /**
   * 触发 mission 时传给 startMissionFromTemplateScheduled 的 inputParams。
   * kind='platform' 不读;kind='workflow_template' 应符合该模板的 inputFields 形状。
   */
  payload: jsonb("payload").$type<Record<string, unknown>>(),

  /** 上次实际派发时间(scheduler 写入) */
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),

  /** 上次派发结果状态:success / failed / skipped */
  lastRunStatus: text("last_run_status"),

  /** 上次派发耗时(ms),包含 cron-parser 计算 + send event 的时间(纯调度耗时,不含业务函数执行时间) */
  lastRunDurationMs: integer("last_run_duration_ms"),

  /**
   * 下次预定执行时间 —— scheduler 每次派发后用 cron-parser 算好写入。
   * 查询时 WHERE next_run_at <= NOW() 就能高效定位到点的 job。
   */
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),

  /** 累计成功派发次数 */
  totalRuns: bigint("total_runs", { mode: "number" }).notNull().default(0),

  /** 累计失败派发次数 */
  totalFailures: bigint("total_failures", { mode: "number" }).notNull().default(0),

  /** 创建/更新时间 */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  enabledNextRunIdx: index("scheduled_jobs_enabled_next_run_idx").on(t.enabled, t.nextRunAt),
  // 2026-05-29:按租户 + kind + 模板查 schedule 的热路径(workflow-template-schedules DAL)
  orgKindTemplateIdx: index("scheduled_jobs_org_kind_template_idx").on(
    t.organizationId,
    t.kind,
    t.workflowTemplateId,
    t.enabled,
  ),
}));

export type ScheduledJob = typeof scheduledJobs.$inferSelect;
export type NewScheduledJob = typeof scheduledJobs.$inferInsert;
