"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  appendMessage,
  getConversationById,
} from "@/lib/dal/cowork-conversations";

/** 多版本卡默认平台（社媒多平台；多语种留 follow-up）。 */
const DEFAULT_PLATFORMS = ["weibo", "douyin", "wechat_oa", "xiaohongshu"];

/**
 * 在 cowork 会话里落一条「多版本生成卡」消息（由稿件卡「多版本」按钮触发）。
 * 仅落卡，实际各平台生成由卡片内「一键生成」调 generateVariantAction。
 */
export async function startMultiVersion(
  conversationId: string,
  articleId: string,
  platforms: string[] = DEFAULT_PLATFORMS,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, error: "用户未关联组织" };
  const convo = await getConversationById(orgId, user.id, conversationId);
  if (!convo) return { ok: false, error: "对话不存在或无权访问" };
  if (!articleId) return { ok: false, error: "缺少稿件" };

  await appendMessage(conversationId, {
    role: "assistant",
    content: "已为这条稿件准备多平台分发，选择平台一键生成各端版本",
    kind: "multi_version_card",
    meta: { articleId, platforms },
  });
  revalidatePath(`/cowork/${conversationId}`);
  return { ok: true };
}
