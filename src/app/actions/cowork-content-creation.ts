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
  // ⚠️ content_generate 失败不抛错，而是返回 { content:"[生成失败] …", wordCount:0 }（ok 仍为 true）。
  // 必须在落库前拦截哨兵/空内容，否则会把伪造的"[生成失败]…"当正文存进稿件库 + 发误导性 draft_result。
  const { content, wordCount } = (gen.ok ? gen.result : { content: "", wordCount: 0 }) as { content: string; wordCount: number };
  if (!gen.ok || !content?.trim() || wordCount === 0 || content.startsWith("[生成失败]")) {
    const err = !gen.ok ? gen.error : (content?.replace(/^\[生成失败\]\s*/, "") || "生成内容为空");
    await appendMessage(conversationId, { role: "assistant", content: `写稿失败：${err}`, kind: "text" });
    revalidatePath(`/cowork/${conversationId}`);
    return { ok: false, error: err };
  }
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
  // meta 瘦身：已入库时只放 bodyPreview（文章本身才是真相源，整篇 body 入 jsonb 会膨胀每次会话加载）；
  // 仅在降级（articleId 为 null、没有可打开的编辑器）时把整篇 body 兜底进 meta。
  await appendMessage(conversationId, {
    role: "assistant",
    content: title,
    kind: "draft_result",
    meta: {
      articleId, archived: !!articleId, title,
      bodyPreview: body.slice(0, 200),
      wordCount: body.length,
      channel: CHANNEL_PRESETS[plan.channel].label, genre: GENRE_LABELS[plan.genre], illustrate: plan.illustrate,
      ...(articleId ? {} : { body }),
    },
  });
  revalidatePath(`/cowork/${conversationId}`);
  return { ok: true, articleId };
}
