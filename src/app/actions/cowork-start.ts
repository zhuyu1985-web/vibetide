"use server";

/**
 * startCoworkConversation —— 落地页"发一句话直接开新会话"的入口。
 * 建会话(标题取自首句)→ 复用 submitCoworkMessage 走意图→mission/chat →
 * 返回新会话 id 供前端跳转 /cowork/[id]。
 *
 * startCoworkScenario —— 场景卡片"启动"的对话框模式入口。
 * 建会话(标题取模板名)→ 落用户指令消息 → startMissionFromTemplate(挂
 * conversationId)→ 落 mission_card → 返回会话 id 供前端跳转 /cowork/[id],
 * 进入后 MissionDrawer 因存在 mission_card 自动展开。
 */
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  appendMessage,
  createConversation,
} from "@/lib/dal/cowork-conversations";
import { getWorkflowTemplate } from "@/lib/dal/workflow-templates";
import { submitCoworkMessage } from "@/app/actions/cowork-submit";
import { startMissionFromTemplate } from "@/app/actions/workflow-launch";
import { deriveConversationTitle } from "@/lib/cowork/conversation-title";
import { buildUserInstruction } from "@/lib/workflow-instruction";
import { validateInputs } from "@/lib/input-fields-validation";
import type { InputFieldDef } from "@/lib/types";

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

export type StartCoworkScenarioResult =
  | { ok: false; errors: Record<string, string> }
  | { ok: true; conversationId: string; missionId?: string };

export async function startCoworkScenario(
  templateId: string,
  inputs: Record<string, unknown>,
  opts: { projectId?: string | null } = {},
): Promise<StartCoworkScenarioResult> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const template = await getWorkflowTemplate(templateId);
  if (!template || template.organizationId !== orgId) {
    return { ok: false, errors: { _global: "模板不存在或无权访问" } };
  }

  // 先做字段校验:失败时不建会话,错误回填启动表单让用户修改。
  const validated = validateInputs(
    (template.inputFields ?? []) as InputFieldDef[],
    inputs,
  );
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const convo = await createConversation(orgId, user.id, {
    title: template.name,
    projectId: opts.projectId ?? null,
  });

  // 对话里的用户消息与 mission.userInstruction 用同一份文案——对话模式下
  // 等价于"用户对 AI 团队说了这句话,AI 据此启动了任务"。
  await appendMessage(convo.id, {
    role: "user",
    content: buildUserInstruction(
      template.name,
      validated.cleaned,
      template.promptTemplate,
    ),
    kind: "text",
  });

  const res = await startMissionFromTemplate(template.id, validated.cleaned, {
    conversationId: convo.id,
    projectId: opts.projectId ?? null,
  });

  if (!res.ok) {
    // 字段错误已在上面拦截,走到这里是模板/库层的罕见失败。会话已建:
    // 把失败写进对话并带用户进入会话查看(与 startCoworkConversation 容错一致)。
    await appendMessage(convo.id, {
      role: "assistant",
      content: `任务启动失败：${res.errors._global ?? "请稍后重试"}`,
      kind: "text",
    });
    revalidatePath(`/cowork/${convo.id}`);
    return { ok: true, conversationId: convo.id };
  }

  await appendMessage(convo.id, {
    role: "assistant",
    content: `已启动「${template.name}」`,
    kind: "mission_card",
    missionId: res.missionId,
  });
  revalidatePath(`/cowork/${convo.id}`);
  return { ok: true, conversationId: convo.id, missionId: res.missionId };
}
