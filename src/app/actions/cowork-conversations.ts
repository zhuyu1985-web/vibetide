"use server";

/**
 * Server actions —— cowork 会话的写路径(新建/重命名/移动项目/归档/删除)。
 *
 * 注意:这是 cowork 新会话(conversations 表),与旧 conversations.ts
 * (saved_conversations)互不干扰。消息追加由 /api/chat 链路在执行期写入,
 * 不在此暴露。
 */
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { conversationMessages } from "@/db/schema/conversations";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  appendMessage,
  createConversation,
  deleteConversation,
  getConversationById,
  updateConversation,
} from "@/lib/dal/cowork-conversations";
import type {
  Conversation,
  ConversationMessage,
} from "@/db/schema/conversations";

export type MessageFeedback = "like" | "dislike" | null;

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
    // 归档时自动清置顶(正交边界:归档的会话不再占置顶位)
    ...(archived ? { pinnedAt: null } : {}),
  });
  if (!updated) return { ok: false, errors: { _global: "对话不存在或无权访问" } };

  revalidatePath("/home");
  return { ok: true, data: updated };
}

export async function pinConversationAction(
  id: string,
  pinned: boolean,
): Promise<ActionResult<Conversation>> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const updated = await updateConversation(orgId, user.id, id, {
    pinnedAt: pinned ? new Date() : null,
  });
  if (!updated) return { ok: false, errors: { _global: "对话不存在或无权访问" } };

  revalidatePath("/home");
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

// ─── 消息追加(P3 前端编排对话线程时调用)─────────────────────────────────
// 三类消息:用户输入 / free_chat 助手文本 / mission_card(承载 mission)。
// 每个 action 先校验会话 ownership,再调 DAL appendMessage(同时顶 lastMessageAt)。

/** 校验会话归属;成功返回 null,失败返回错误结果 */
async function _assertConversationOwned(
  conversationId: string,
): Promise<{ ok: true; userId: string } | { ok: false; errors: FieldErrors }> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };
  const convo = await getConversationById(orgId, user.id, conversationId);
  if (!convo) return { ok: false, errors: { _global: "对话不存在或无权访问" } };
  return { ok: true, userId: user.id };
}

export async function appendUserMessageAction(
  conversationId: string,
  content: string,
): Promise<ActionResult<ConversationMessage>> {
  if (!content.trim()) return { ok: false, errors: { content: "消息不能为空" } };
  const owned = await _assertConversationOwned(conversationId);
  if (!owned.ok) return owned;

  const message = await appendMessage(conversationId, {
    role: "user",
    content: content.trim(),
    kind: "text",
  });
  revalidatePath(`/cowork/${conversationId}`);
  return { ok: true, data: message };
}

export async function appendAssistantTextMessageAction(
  conversationId: string,
  content: string,
  meta?: Record<string, unknown>,
): Promise<ActionResult<ConversationMessage>> {
  const owned = await _assertConversationOwned(conversationId);
  if (!owned.ok) return owned;

  const message = await appendMessage(conversationId, {
    role: "assistant",
    content,
    kind: "text",
    meta: meta ?? null,
  });
  revalidatePath(`/cowork/${conversationId}`);
  return { ok: true, data: message };
}

export async function appendMissionCardMessageAction(
  conversationId: string,
  missionId: string,
  content?: string,
): Promise<ActionResult<ConversationMessage>> {
  const owned = await _assertConversationOwned(conversationId);
  if (!owned.ok) return owned;

  const message = await appendMessage(conversationId, {
    role: "assistant",
    content: content ?? "",
    kind: "mission_card",
    missionId,
  });
  revalidatePath(`/cowork/${conversationId}`);
  return { ok: true, data: message };
}

/**
 * 回答的「喜欢 / 不喜欢」反馈,存进消息的 meta.feedback(再点一次同值 = 取消)。
 * 校验消息所属会话归当前用户;不 revalidate —— 前端乐观切换视觉态即可,持久化
 * 供下次加载读取。
 */
export async function setMessageFeedbackAction(
  messageId: string,
  value: MessageFeedback,
): Promise<ActionResult> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const [msg] = await db
    .select({ conversationId: conversationMessages.conversationId })
    .from(conversationMessages)
    .where(eq(conversationMessages.id, messageId))
    .limit(1);
  if (!msg) return { ok: false, errors: { _global: "消息不存在" } };

  const convo = await getConversationById(orgId, user.id, msg.conversationId);
  if (!convo) return { ok: false, errors: { _global: "无权访问该消息" } };

  await db
    .update(conversationMessages)
    .set({
      meta: sql`coalesce(${conversationMessages.meta}, '{}'::jsonb) || ${JSON.stringify(
        { feedback: value },
      )}::jsonb`,
    })
    .where(eq(conversationMessages.id, messageId));

  return { ok: true };
}
