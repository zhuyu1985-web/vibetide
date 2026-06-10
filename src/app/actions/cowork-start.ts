"use server";

/**
 * startCoworkConversation —— 落地页"发一句话直接开新会话"的入口。
 * 建会话(标题取自首句)→ 复用 submitCoworkMessage 走意图→mission/chat →
 * 返回新会话 id 供前端跳转 /cowork/[id]。
 */
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { createConversation } from "@/lib/dal/cowork-conversations";
import { submitCoworkMessage } from "@/app/actions/cowork-submit";
import { deriveConversationTitle } from "@/lib/cowork/conversation-title";

export type StartCoworkResult =
  | { ok: false; error: string }
  | { ok: true; conversationId: string; missionId?: string };

export async function startCoworkConversation(
  message: string,
  opts: { projectId?: string | null } = {},
): Promise<StartCoworkResult> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, error: "用户未关联组织" };
  const text = message.trim();
  if (!text) return { ok: false, error: "消息不能为空" };

  const convo = await createConversation(orgId, user.id, {
    title: deriveConversationTitle(text),
    projectId: opts.projectId ?? null,
  });

  const res = await submitCoworkMessage(convo.id, text);
  // 会话已建:即便首条执行失败也返回 id,让用户进入会话查看/重试。
  if (!res.ok) return { ok: true, conversationId: convo.id };

  return {
    ok: true,
    conversationId: convo.id,
    missionId: res.kind === "mission" ? res.missionId : undefined,
  };
}
