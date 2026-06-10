"use server";

/**
 * Server actions —— cowork 会话的写路径(新建/重命名/移动项目/归档/删除)。
 *
 * 注意:这是 cowork 新会话(conversations 表),与旧 conversations.ts
 * (saved_conversations)互不干扰。消息追加由 /api/chat 链路在执行期写入,
 * 不在此暴露。
 */
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  createConversation,
  deleteConversation,
  updateConversation,
} from "@/lib/dal/cowork-conversations";
import type { Conversation } from "@/db/schema/conversations";

type FieldErrors = Record<string, string>;
type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; errors: FieldErrors };

export interface CreateConversationActionInput {
  title?: string;
  projectId?: string | null;
}

export async function createConversationAction(
  input: CreateConversationActionInput = {},
): Promise<ActionResult<Conversation>> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const conversation = await createConversation(orgId, user.id, {
    title: input.title?.trim() || "新对话",
    projectId: input.projectId ?? null,
  });

  revalidatePath("/cowork");
  return { ok: true, data: conversation };
}

export async function renameConversationAction(
  id: string,
  title: string,
): Promise<ActionResult<Conversation>> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };
  if (!title.trim()) return { ok: false, errors: { title: "标题不能为空" } };

  const updated = await updateConversation(orgId, user.id, id, {
    title: title.trim(),
  });
  if (!updated) return { ok: false, errors: { _global: "对话不存在或无权访问" } };

  revalidatePath("/cowork");
  return { ok: true, data: updated };
}

export async function moveConversationToProjectAction(
  id: string,
  projectId: string | null,
): Promise<ActionResult<Conversation>> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const updated = await updateConversation(orgId, user.id, id, { projectId });
  if (!updated) return { ok: false, errors: { _global: "对话不存在或无权访问" } };

  revalidatePath("/cowork");
  return { ok: true, data: updated };
}

export async function archiveConversationAction(
  id: string,
  archived: boolean,
): Promise<ActionResult<Conversation>> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const updated = await updateConversation(orgId, user.id, id, {
    status: archived ? "archived" : "active",
  });
  if (!updated) return { ok: false, errors: { _global: "对话不存在或无权访问" } };

  revalidatePath("/cowork");
  return { ok: true, data: updated };
}

export async function deleteConversationAction(
  id: string,
): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const deleted = await deleteConversation(orgId, user.id, id);
  if (!deleted) return { ok: false, errors: { _global: "对话不存在或无权访问" } };

  revalidatePath("/cowork");
  return { ok: true };
}
