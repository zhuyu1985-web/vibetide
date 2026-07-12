"use server";

/**
 * Server actions —— 运营在 /workflows/[id] "定时任务" tab 上的写路径。
 *
 * 每个 action 流程:
 *   1. requireAuth() —— 必须登录
 *   2. getCurrentUserOrg() —— 拿到当前用户的 org,不存在则拒绝
 *   3. 校验模板属于该 org(防止跨租户操作他人模板的 schedule)
 *   4. 校验 cron 合法 + 周期下限(create/update 时)
 *   5. 调 DAL 写入
 *   6. revalidatePath
 *
 * 错误返回格式与 startMissionFromTemplate 一致:
 *   - 成功:{ ok: true, schedule? }
 *   - 失败:{ ok: false, errors: { fieldName: msg } 或 { _global: msg } }
 */
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { validateCronExpression } from "@/lib/cron";
import {
  createSchedule,
  deleteSchedule,
  getScheduleById,
  toggleSchedule,
  updateSchedule,
} from "@/lib/dal/workflow-template-schedules";
import type { ScheduledJob } from "@/db/schema/scheduled-jobs";

type FieldErrors = Record<string, string>;
type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; errors: FieldErrors };

/** 校验 (orgId, templateId) 组合合法,返回模板行或字段错误 */
async function _loadOwnedTemplate(orgId: string, templateId: string) {
  const tpl = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.id, templateId),
      eq(workflowTemplates.organizationId, orgId),
    ),
    columns: { id: true, name: true },
  });
  return tpl ?? null;
}

export interface CreateScheduleActionInput {
  workflowTemplateId: string;
  displayName: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  payload?: Record<string, unknown>;
  enabled?: boolean;
}

export async function createWorkflowTemplateSchedule(
  input: CreateScheduleActionInput,
): Promise<ActionResult<ScheduledJob>> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const errors: FieldErrors = {};
  if (!input.displayName?.trim()) errors.displayName = "请填写名称";
  if (!input.workflowTemplateId) errors.workflowTemplateId = "缺少模板 id";

  const timezone = input.timezone || "Asia/Shanghai";
  const cronCheck = validateCronExpression(input.cronExpression, timezone);
  if (!cronCheck.ok) errors.cronExpression = cronCheck.error;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const tpl = await _loadOwnedTemplate(orgId, input.workflowTemplateId);
  if (!tpl) return { ok: false, errors: { _global: "模板不存在或无权访问" } };

  const schedule = await createSchedule(orgId, {
    name: `wf-${tpl.id.slice(0, 8)}-${nanoid(6)}`,
    displayName: input.displayName.trim(),
    description: input.description?.trim() || undefined,
    workflowTemplateId: tpl.id,
    cronExpression: input.cronExpression.trim(),
    timezone,
    payload: input.payload,
    enabled: input.enabled ?? true,
  });

  revalidatePath(`/workflows/${tpl.id}`);
  revalidatePath("/cowork/schedules");
  revalidatePath("/admin/scheduled-jobs");

  return { ok: true, data: schedule };
}

export interface UpdateScheduleActionInput {
  id: string;
  displayName?: string;
  description?: string | null;
  cronExpression?: string;
  timezone?: string;
  payload?: Record<string, unknown> | null;
  enabled?: boolean;
}

export async function updateWorkflowTemplateSchedule(
  input: UpdateScheduleActionInput,
): Promise<ActionResult<ScheduledJob>> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const existing = await getScheduleById(orgId, input.id);
  if (!existing) return { ok: false, errors: { _global: "定时任务不存在或无权访问" } };

  const errors: FieldErrors = {};

  // 只在 cron / timezone 任一被改时重新校验(校验新组合)
  const willUpdateCron = input.cronExpression !== undefined;
  const willUpdateTz = input.timezone !== undefined;
  if (willUpdateCron || willUpdateTz) {
    const newCron = input.cronExpression ?? existing.cronExpression;
    const newTz = input.timezone ?? existing.timezone;
    const cronCheck = validateCronExpression(newCron, newTz);
    if (!cronCheck.ok) errors.cronExpression = cronCheck.error;
  }

  if (input.displayName !== undefined && !input.displayName.trim()) {
    errors.displayName = "名称不能为空";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const updated = await updateSchedule(orgId, input.id, {
    displayName: input.displayName?.trim(),
    description:
      input.description === null
        ? null
        : input.description?.trim() || undefined,
    cronExpression: input.cronExpression?.trim(),
    timezone: input.timezone,
    payload: input.payload,
    enabled: input.enabled,
  });
  if (!updated) return { ok: false, errors: { _global: "更新失败" } };

  if (existing.workflowTemplateId) {
    revalidatePath(`/workflows/${existing.workflowTemplateId}`);
  }
  revalidatePath("/cowork/schedules");
  revalidatePath("/admin/scheduled-jobs");
  return { ok: true, data: updated };
}

export async function toggleWorkflowTemplateSchedule(
  id: string,
  enabled: boolean,
): Promise<ActionResult<ScheduledJob>> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const existing = await getScheduleById(orgId, id);
  if (!existing) return { ok: false, errors: { _global: "定时任务不存在或无权访问" } };

  const updated = await toggleSchedule(orgId, id, enabled);
  if (!updated) return { ok: false, errors: { _global: "切换失败" } };

  if (existing.workflowTemplateId) {
    revalidatePath(`/workflows/${existing.workflowTemplateId}`);
  }
  revalidatePath("/cowork/schedules");
  revalidatePath("/admin/scheduled-jobs");
  return { ok: true, data: updated };
}

export async function deleteWorkflowTemplateSchedule(
  id: string,
): Promise<ActionResult> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const existing = await getScheduleById(orgId, id);
  if (!existing) return { ok: false, errors: { _global: "定时任务不存在或无权访问" } };

  await deleteSchedule(orgId, id);
  if (existing.workflowTemplateId) {
    revalidatePath(`/workflows/${existing.workflowTemplateId}`);
  }
  revalidatePath("/cowork/schedules");
  revalidatePath("/admin/scheduled-jobs");
  return { ok: true };
}
