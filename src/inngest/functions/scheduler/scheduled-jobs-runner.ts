/**
 * scheduledJobsRunner —— 平台级 cron 调度中枢。
 *
 * 每分钟跑一次,扫描 scheduled_jobs 表,对每条 enabled = true 的记录:
 *   1. 用 cron-parser 算 next_run_at(基于 cron_expression + timezone)
 *   2. 如果 next_run_at <= NOW(),按 kind 分叉派发事件:
 *      - kind='platform':派发 row.eventName(写死的 typed event)
 *      - kind='workflow_template':派发统一的 `scheduled-jobs/workflow-template.run`
 *        event,data 里塞 workflowTemplateId / organizationId / inputParams
 *   3. 更新 last_run_at / last_run_status / total_runs / next_run_at(算下一次)
 *
 * 2026-05-29 — 新增 workflow_template kind 分叉(per-job jitter 用 sendEvent 的
 * `ts` 字段做 durable 延迟交付,而非 step.sleep —— 后者会序列化整个 for 循环,
 * 在 30+ jobs 场景下会超过 60s tick 窗口)
 *
 * 设计要点:
 *   - 这是项目里唯一保留的硬编码 cron 函数(必须有 ≥1 个 cron 才能驱动整个体系)
 *   - 业务函数从订阅 cron 改为订阅 event,这样 cron 表达式可在 DB / UI 上动态修改,
 *     无需重启 Next.js 就能生效
 *   - 容错:某条 job 派发失败不影响其他;失败计入 total_failures + last_run_status="failed"
 *   - 幂等:next_run_at 一旦写入,后续 tick 严格按"过去时间才派发"判断,不会重复派发
 */

import { CronExpressionParser } from "cron-parser";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { db } from "@/db";
import { scheduledJobs } from "@/db/schema";

/**
 * Platform-kind 派发的 typed event 集合 —— 不含 workflow-template.run
 * (后者的 payload 形状不同,kind='workflow_template' 分支单独处理)
 */
type PlatformScheduledEventName = keyof {
  [K in keyof InngestEvents as K extends `scheduled-jobs/${string}`
    ? K extends "scheduled-jobs/workflow-template.run"
      ? never
      : K
    : never]: true;
};

/** workflow_template kind 全部派同一个 event,payload 区分模板 */
const WORKFLOW_TEMPLATE_RUN_EVENT = "scheduled-jobs/workflow-template.run" as const;

/** workflow_template kind 的 per-job 派发时间打散区间 ±15 秒,避免同分启动风暴 */
const WORKFLOW_TEMPLATE_JITTER_MAX_MS = 15_000;

/** 用 jobId 当种子算 deterministic jitter,同一个 job 每次 jitter 一致,便于排查 */
function computeJitterMs(jobId: string): number {
  let h = 0;
  for (let i = 0; i < jobId.length; i++) {
    h = (h * 31 + jobId.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % WORKFLOW_TEMPLATE_JITTER_MAX_MS;
}

export const scheduledJobsRunner = inngest.createFunction(
  {
    id: "scheduled-jobs-runner",
    name: "Scheduler · 定时任务调度中枢",
    concurrency: { limit: 1 }, // 串行,避免同一 job 被并发派发
    retries: 0,
  },
  { cron: "* * * * *" }, // 每分钟跑一次
  async ({ step, logger }) => {
    const now = new Date();

    // 1. 取所有 enabled 且(next_run_at 已过 或 还未计算过 next_run_at)的 job
    const dueJobs = await step.run("load-due-jobs", async () =>
      db
        .select()
        .from(scheduledJobs)
        .where(
          and(
            eq(scheduledJobs.enabled, true),
            or(isNull(scheduledJobs.nextRunAt), lte(scheduledJobs.nextRunAt, now)),
          ),
        ),
    );

    if (dueJobs.length === 0) {
      return { dispatched: 0, total: 0 };
    }

    logger.info(`[scheduler] ${dueJobs.length} 个 job 到点,准备派发`);

    let dispatched = 0;
    let failed = 0;
    const errors: Array<{ name: string; error: string }> = [];

    for (const job of dueJobs) {
      const startMs = Date.now();
      try {
        // 关键:isFirstRun 区分初始化(刚加进表)vs 真正到点。
        // 初始化只算 next_run_at 不派发事件,避免新 job 一上来就立刻跑一遍。
        const isFirstRun = job.nextRunAt === null;

        if (!isFirstRun) {
          const scheduledAt = job.nextRunAt
            ? new Date(job.nextRunAt).toISOString()
            : now.toISOString();

          // ─── 按 kind 分叉派发 ───
          if (job.kind === "workflow_template") {
            // workflow-template kind 必须有 organizationId + workflowTemplateId
            if (!job.organizationId || !job.workflowTemplateId) {
              throw new Error(
                `workflow_template kind job 缺少 organizationId/workflowTemplateId(jobId=${job.id})`,
              );
            }
            const jitterMs = computeJitterMs(job.id);
            await step.sendEvent(`dispatch-${job.name}`, {
              name: WORKFLOW_TEMPLATE_RUN_EVENT,
              // ts 让 Inngest 在 jittered 时间点投递事件 —— durable & 不阻塞 for 循环
              ts: now.getTime() + jitterMs,
              data: {
                jobName: job.name,
                jobId: job.id,
                dispatchedAt: now.toISOString(),
                scheduledAt,
                workflowTemplateId: job.workflowTemplateId,
                organizationId: job.organizationId,
                inputParams: (job.payload ?? {}) as Record<string, unknown>,
              },
            });
          } else {
            // kind='platform' —— 老路径,事件名在 DB 配置 → runtime string,cast 到 typed
            await step.sendEvent(`dispatch-${job.name}`, {
              name: job.eventName as PlatformScheduledEventName,
              data: {
                jobName: job.name,
                jobId: job.id,
                dispatchedAt: now.toISOString(),
                scheduledAt,
              },
            });
          }
          dispatched++;
        }

        // 算下一次执行时间
        const interval = CronExpressionParser.parse(job.cronExpression, {
          tz: job.timezone,
          currentDate: now,
        });
        const nextRun = interval.next().toDate();

        // Drizzle 的 set() 接受 Date 但不接受 string;db row 的 lastRunAt 已经是
        // Date 类型,直接传回去即可。
        await db
          .update(scheduledJobs)
          .set({
            ...(isFirstRun ? {} : { lastRunAt: now, lastRunStatus: "success" }),
            lastRunDurationMs: Date.now() - startMs,
            nextRunAt: nextRun,
            ...(isFirstRun ? {} : { totalRuns: sql`${scheduledJobs.totalRuns} + 1` }),
            updatedAt: now,
          })
          .where(eq(scheduledJobs.id, job.id));
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ name: job.name, error: msg });
        logger.error(`[scheduler] ${job.name} 派发失败: ${msg}`);

        // 失败也要算 next_run_at,避免一直卡在这条 job 不放
        let nextRun: Date | null = null;
        try {
          nextRun = CronExpressionParser.parse(job.cronExpression, {
            tz: job.timezone,
            currentDate: now,
          })
            .next()
            .toDate();
        } catch {
          // cron 表达式本身就有问题 — 写 NULL 避免误派发
        }

        await db
          .update(scheduledJobs)
          .set({
            lastRunAt: now,
            lastRunStatus: "failed",
            lastRunDurationMs: Date.now() - startMs,
            nextRunAt: nextRun,
            totalFailures: sql`${scheduledJobs.totalFailures} + 1`,
            updatedAt: now,
          })
          .where(eq(scheduledJobs.id, job.id));
      }
    }

    return { dispatched, failed, total: dueJobs.length, errors };
  },
);
