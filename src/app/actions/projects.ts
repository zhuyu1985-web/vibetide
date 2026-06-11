"use server";

/**
 * Server actions —— cowork 项目分组的写路径。
 *
 * 流程与 workflow-template-schedules 一致:
 *   requireAuth → getCurrentUserOrg → (ownership 校验) → DAL → revalidatePath
 * 返回格式:成功 { ok: true, data? };失败 { ok: false, errors }。
 */
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  createProject,
  deleteProject,
  getProjectById,
  setProjectArchived,
  updateProject,
} from "@/lib/dal/projects";
import type { Project } from "@/db/schema/projects";

type FieldErrors = Record<string, string>;
type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; errors: FieldErrors };

export interface CreateProjectActionInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export async function createProjectAction(
  input: CreateProjectActionInput,
): Promise<ActionResult<Project>> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  if (!input.name?.trim()) return { ok: false, errors: { name: "请填写项目名称" } };

  const project = await createProject(orgId, user.id, {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    icon: input.icon || null,
    color: input.color || null,
  });

  revalidatePath("/cowork");
  return { ok: true, data: project };
}

export interface UpdateProjectActionInput {
  id: string;
  name?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
}

export async function updateProjectAction(
  input: UpdateProjectActionInput,
): Promise<ActionResult<Project>> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const existing = await getProjectById(orgId, input.id);
  if (!existing) return { ok: false, errors: { _global: "项目不存在或无权访问" } };

  if (input.name !== undefined && !input.name.trim()) {
    return { ok: false, errors: { name: "项目名称不能为空" } };
  }

  const updated = await updateProject(orgId, input.id, {
    name: input.name?.trim(),
    description: input.description === null ? null : input.description?.trim(),
    icon: input.icon,
    color: input.color,
  });
  if (!updated) return { ok: false, errors: { _global: "更新失败" } };

  revalidatePath("/cowork");
  return { ok: true, data: updated };
}

export async function archiveProjectAction(
  id: string,
  archived: boolean,
): Promise<ActionResult<Project>> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const existing = await getProjectById(orgId, id);
  if (!existing) return { ok: false, errors: { _global: "项目不存在或无权访问" } };

  const updated = await setProjectArchived(orgId, id, archived);
  if (!updated) return { ok: false, errors: { _global: "操作失败" } };

  revalidatePath("/cowork");
  return { ok: true, data: updated };
}

export async function pinProjectAction(
  id: string,
  pinned: boolean,
): Promise<ActionResult<Project>> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const existing = await getProjectById(orgId, id);
  if (!existing) return { ok: false, errors: { _global: "项目不存在或无权访问" } };

  const updated = await updateProject(orgId, id, {
    pinnedAt: pinned ? new Date() : null,
  });
  if (!updated) return { ok: false, errors: { _global: "操作失败" } };

  revalidatePath("/cowork/projects");
  return { ok: true, data: updated };
}

export async function deleteProjectAction(id: string): Promise<ActionResult> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const existing = await getProjectById(orgId, id);
  if (!existing) return { ok: false, errors: { _global: "项目不存在或无权访问" } };

  await deleteProject(orgId, id);
  revalidatePath("/cowork");
  return { ok: true };
}
