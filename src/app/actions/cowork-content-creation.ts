"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { appendMessage, getConversationById } from "@/lib/dal/cowork-conversations";
import { appendArticleVersion } from "@/lib/dal/article-versions";
import { invokeToolDirectly } from "@/lib/agent/tool-registry";
import { deriveTitle, splitTitleBody } from "@/lib/content/revise";
import { planToGenerateParams, GENRE_LABELS, CHANNEL_PRESETS, type CreationPlan } from "@/lib/cowork/creation-plan";

export type ConfirmPlanResult = { ok: false; error: string } | { ok: true; articleId: string | null };

export async function confirmCreationPlan(conversationId: string, plan: CreationPlan): Promise<ConfirmPlanResult> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, error: "用户未关联组织" };
  if (!plan.topic?.title?.trim()) return { ok: false, error: "请先填写选题" };
  const convo = await getConversationById(orgId, user.id, conversationId);
  if (!convo) return { ok: false, error: "对话不存在或无权访问" };

  // 1. 写稿
  const { outline, style, maxLength } = planToGenerateParams(plan);
  const gen = await invokeToolDirectly("content_generate", { outline, style, maxLength },
    { organizationId: orgId, operatorId: user.id });
  if (!gen.ok) {
    await appendMessage(conversationId, { role: "assistant", content: `写稿失败：${gen.error}`, kind: "text" });
    revalidatePath(`/cowork/${conversationId}`);
    return { ok: false, error: gen.error };
  }
  const { content } = gen.result as { content: string; wordCount: number };
  const { title, body } = splitTitleBody(content, deriveTitle(content, plan.topic.title));

  // 2. 落 articles 草稿（⚠️ 必须显式 initialStatus:"draft"）
  const arch = await invokeToolDirectly("archive_to_drafts", {
    articles: [{ title, body, language: "zh" }],
    initialStatus: "draft", dedupBySourceUrl: false, organizationId: orgId,
  }, { organizationId: orgId, operatorId: user.id });
  const articleId = arch.ok ? ((arch.result as { firstArticleId?: string | null }).firstArticleId ?? null) : null;

  if (articleId) {
    await appendArticleVersion({
      organizationId: orgId, articleId, language: "zh", title, body,
      wordCount: body.length, changeKind: "initial", createdBy: user.id,
    }).catch((e) => console.error("[cowork-content] 初稿版本留痕失败:", e));
  }

  // 3. 落 draft_result 消息
  await appendMessage(conversationId, {
    role: "assistant",
    content: title,
    kind: "draft_result",
    meta: {
      articleId, archived: !!articleId, title, body, wordCount: body.length,
      channel: CHANNEL_PRESETS[plan.channel].label, genre: GENRE_LABELS[plan.genre], illustrate: plan.illustrate,
    },
  });
  revalidatePath(`/cowork/${conversationId}`);
  return { ok: true, articleId };
}
