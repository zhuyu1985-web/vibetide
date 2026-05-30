/**
 * workflow-template-schedules DAL —— `/workflows/[id]` 定时任务 tab 的读写接口。
 *
 * 所有查询/写入都被 (organization_id, kind='workflow_template') 二元约束严格
 * 过滤,避免误读/误写到平台级 cron 行(13 条遗留 platform job 与本表共表共存)。
 *
 * 运行链路:
 *   UI / server action → 本 DAL → scheduled_jobs(kind='workflow_template')
 *      → scheduledJobsRunner 每分钟扫表
 *      → 派 'scheduled-jobs/workflow-template.run' event
 *      → workflowTemplateScheduledLaunch handler
 *      → startMissionFromTemplateScheduled
 *
 * 错误处理约定:DAL 不抛 user-facing 错;参数非法直接 throw,由 server action 包装。
 */
import { db } from "@/db";
import { scheduledJobs, workflowTemplates } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

/** 统一 event 名 —— runner 派发 workflow_template kind 时固定用这个 */
export const WORKFLOW_TEMPLATE_RUN_EVENT = "scheduled-jobs/workflow-template.run";

/** DAL 层共用的"kind = workflow_template + org 隔离"过滤,确保不串到平台级行 */
function orgScopedTemplateKindFilter(orgId: string) {
  return and(
    eq(scheduledJobs.kind, "workflow_template"),
    eq(scheduledJobs.organizationId, orgId),
  );
}

export interface CreateScheduleInput {
  /** scheduled_jobs.name —— 全局唯一,推荐 `wf-${templateId}-${nanoid(6)}` */
  name: string;
  /** UI 展示名,如 "每日早 9 点抓热点" */
  displayName: string;
  description?: string;
  /** 关联的模板 id;DAL 假定 server action 已校验 ownership */
  workflowTemplateId: string;
  cronExpression: string;
  timezone?: string;
  payload?: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateScheduleInput {
  displayName?: string;
  description?: string | null;
  cronExpression?: string;
  timezone?: string;
  payload?: Record<string, unknown> | null;
  enabled?: boolean;
}

/** 列出某模板下的所有 schedule(按创建时间倒序) */
export async function listSchedulesByTemplate(orgId: string, templateId: string) {
  return db
    .select()
    .from(scheduledJobs)
    .where(
      and(
        orgScopedTemplateKindFilter(orgId),
        eq(scheduledJobs.workflowTemplateId, templateId),
      ),
    )
    .orderBy(desc(scheduledJobs.createdAt));
}

/** 列出整个 org 的全部 workflow-template schedule(用于全局管理视图) */
export async function listSchedulesByOrg(orgId: string) {
  return db
    .select()
    .from(scheduledJobs)
    .where(orgScopedTemplateKindFilter(orgId))
    .orderBy(desc(scheduledJobs.createdAt));
}

/** 取单条 schedule;不存在返回 null;不是当前 org 的也返回 null(避免泄露) */
export async function getScheduleById(orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(scheduledJobs)
    .where(and(orgScopedTemplateKindFilter(orgId), eq(scheduledJobs.id, id)))
    .limit(1);
  return row ?? null;
}

/**
 * 创建 schedule。
 * - kind 固化为 'workflow_template'
 * - eventName 固化为 WORKFLOW_TEMPLATE_RUN_EVENT(runner 实际不读此列,但保持一致)
 * - 不在此校验 cron / ownership —— 由 server action 上游负责,DAL 只管写
 */
export async function createSchedule(orgId: string, input: CreateScheduleInput) {
  const [row] = await db
    .insert(scheduledJobs)
    .values({
      name: input.name,
      displayName: input.displayName,
      description: input.description,
      eventName: WORKFLOW_TEMPLATE_RUN_EVENT,
      cronExpression: input.cronExpression,
      timezone: input.timezone ?? "Asia/Shanghai",
      enabled: input.enabled ?? true,
      category: "workflow_template",
      kind: "workflow_template",
      organizationId: orgId,
      workflowTemplateId: input.workflowTemplateId,
      payload: input.payload ?? {},
    })
    .returning();
  return row;
}

/**
 * 更新 schedule。改 cronExpression / timezone 时会把 nextRunAt 重置为 NULL,
 * 让 runner 下一轮自然重新计算。
 */
export async function updateSchedule(
  orgId: string,
  id: string,
  input: UpdateScheduleInput,
) {
  const patch: Partial<typeof scheduledJobs.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.description !== undefined) patch.description = input.description;
  if (input.cronExpression !== undefined) {
    patch.cronExpression = input.cronExpression;
    patch.nextRunAt = null;
  }
  if (input.timezone !== undefined) {
    patch.timezone = input.timezone;
    patch.nextRunAt = null;
  }
  if (input.payload !== undefined) patch.payload = input.payload;
  if (input.enabled !== undefined) patch.enabled = input.enabled;

  const [row] = await db
    .update(scheduledJobs)
    .set(patch)
    .where(and(orgScopedTemplateKindFilter(orgId), eq(scheduledJobs.id, id)))
    .returning();
  return row ?? null;
}

/** 仅切 enabled 标志(toggle 专用,避免误改其他字段) */
export async function toggleSchedule(orgId: string, id: string, enabled: boolean) {
  const [row] = await db
    .update(scheduledJobs)
    .set({ enabled, updatedAt: new Date() })
    .where(and(orgScopedTemplateKindFilter(orgId), eq(scheduledJobs.id, id)))
    .returning();
  return row ?? null;
}

/** 删除 schedule。注意:不会回滚已经在跑的 mission */
export async function deleteSchedule(orgId: string, id: string) {
  const [row] = await db
    .delete(scheduledJobs)
    .where(and(orgScopedTemplateKindFilter(orgId), eq(scheduledJobs.id, id)))
    .returning({ id: scheduledJobs.id });
  return row?.id ?? null;
}

/** 联合查询:列 + 关联模板名,用于全局视图渲染 */
export async function listSchedulesWithTemplateName(orgId: string) {
  return db
    .select({
      schedule: scheduledJobs,
      templateName: workflowTemplates.name,
      templateIcon: workflowTemplates.icon,
    })
    .from(scheduledJobs)
    .leftJoin(
      workflowTemplates,
      eq(workflowTemplates.id, scheduledJobs.workflowTemplateId),
    )
    .where(orgScopedTemplateKindFilter(orgId))
    .orderBy(desc(scheduledJobs.createdAt));
}
