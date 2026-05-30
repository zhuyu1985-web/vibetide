/**
 * DAL — scheduled_jobs 表读操作。
 *
 * 该表混存两类 job:
 *   - kind='platform'(13 条遗留平台级 cron)
 *   - kind='workflow_template'(2026-05-29 起,运营在 /workflows/[id] 上挂的 schedule)
 *
 * 本 DAL 服务 `/settings/scheduled-jobs` super-admin 后台 —— 跨 org、跨 kind 全量列表。
 * Per-org per-template 的查询见 src/lib/dal/workflow-template-schedules.ts。
 */
import { db } from "@/db";
import {
  organizations,
  scheduledJobs,
  workflowTemplates,
  type ScheduledJob,
} from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function listScheduledJobs(): Promise<ScheduledJob[]> {
  return db
    .select()
    .from(scheduledJobs)
    .orderBy(asc(scheduledJobs.category), asc(scheduledJobs.displayName));
}

export interface ScheduledJobWithRelations extends ScheduledJob {
  organizationName: string | null;
  workflowTemplateName: string | null;
}

/**
 * 管理员视图专用 —— 带上租户名 + 关联模板名,用于在列表里区分 platform vs
 * workflow_template kind。LEFT JOIN 确保 platform 行(无 org/template)仍能返回。
 */
export async function listScheduledJobsWithRelations(): Promise<
  ScheduledJobWithRelations[]
> {
  const rows = await db
    .select({
      job: scheduledJobs,
      organizationName: organizations.name,
      workflowTemplateName: workflowTemplates.name,
    })
    .from(scheduledJobs)
    .leftJoin(organizations, eq(organizations.id, scheduledJobs.organizationId))
    .leftJoin(
      workflowTemplates,
      eq(workflowTemplates.id, scheduledJobs.workflowTemplateId),
    )
    .orderBy(asc(scheduledJobs.category), asc(scheduledJobs.displayName));

  return rows.map((r) => ({
    ...r.job,
    organizationName: r.organizationName,
    workflowTemplateName: r.workflowTemplateName,
  }));
}

export async function getScheduledJobById(id: string): Promise<ScheduledJob | null> {
  const [row] = await db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.id, id))
    .limit(1);
  return row ?? null;
}

export async function getScheduledJobByName(name: string): Promise<ScheduledJob | null> {
  const [row] = await db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.name, name))
    .limit(1);
  return row ?? null;
}
