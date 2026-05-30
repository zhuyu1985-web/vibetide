/**
 * workflowTemplateScheduledLaunch —— 订阅 scheduledJobsRunner 派发的统一
 * event `scheduled-jobs/workflow-template.run`,把 schedule 触发翻译为
 * mission 启动。
 *
 * 单一职责:接收 event → 调用 startMissionFromTemplateScheduled service →
 * 写回 scheduled_jobs 行的状态。
 *
 * 失败处理:
 *   - service 返回 {ok:false} (业务级,如模板被删) → 不抛,直接把 lastRunStatus
 *     回写 'failed' 并把 errors 写入 lastRunDurationMs 旁的日志(无 dedicated 字段
 *     存储 message,先写 logger);后续 change 可补 scheduled_job_failures 表
 *   - service 抛(infra-level) → throw,触发 Inngest 默认重试(最多 retries: 3)
 *
 * 注:scheduledJobsRunner 已经在派发时把 scheduled_jobs.lastRunStatus 标为
 * 'success' + totalRuns++ —— 那是"派发成功",这里 mission 失败要把它回退到 'failed'。
 */
import { eq, sql } from "drizzle-orm";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { scheduledJobs } from "@/db/schema";
import { startMissionFromTemplateScheduled } from "@/app/actions/workflow-launch";

export const workflowTemplateScheduledLaunch = inngest.createFunction(
  {
    id: "workflow-template-scheduled-launch",
    name: "Workflow Template · 定时任务触发 mission",
    retries: 3,
  },
  { event: "scheduled-jobs/workflow-template.run" },
  async ({ event, step, logger }) => {
    const {
      jobName,
      jobId,
      workflowTemplateId,
      organizationId,
      inputParams,
    } = event.data;

    logger.info(
      `[wf-scheduled-launch] 触发 mission: jobName=${jobName} template=${workflowTemplateId} org=${organizationId}`,
    );

    const result = await step.run("start-mission", async () =>
      startMissionFromTemplateScheduled(
        workflowTemplateId,
        organizationId,
        inputParams ?? {},
        {
          source: {
            module: "schedule",
            entityId: jobId,
            entityType: "scheduled_job",
          },
        },
      ),
    );

    if (!result.ok) {
      const errMsg = Object.entries(result.errors)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ");
      logger.error(
        `[wf-scheduled-launch] mission 启动失败 jobName=${jobName}: ${errMsg}`,
      );

      // 把 scheduledJobsRunner 写下的 lastRunStatus='success' 回退为 'failed'
      // 同时减回 totalRuns 增量(scheduler 已 +1)+ 增加 totalFailures
      await step.run("mark-scheduled-job-failed", async () => {
        await db
          .update(scheduledJobs)
          .set({
            lastRunStatus: "failed",
            totalRuns: sql`GREATEST(${scheduledJobs.totalRuns} - 1, 0)`,
            totalFailures: sql`${scheduledJobs.totalFailures} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(scheduledJobs.id, jobId));
      });

      return { ok: false, jobName, error: errMsg };
    }

    logger.info(
      `[wf-scheduled-launch] mission 启动成功 jobName=${jobName} missionId=${result.missionId}`,
    );
    return { ok: true, jobName, missionId: result.missionId };
  },
);
