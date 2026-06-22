/**
 * IM 发布 follow-up — 在 confirming 态由用户回"确认"后调用。
 * 先将稿件置 approved（仅 draft/reviewing），再调 publishArticleToCms。
 */

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { articles } from "@/db/schema";
import { publishArticleToCms, CmsConfigError } from "@/lib/cms";
import type { ChannelSessionRow } from "@/lib/dal/channel-sessions";

export interface ChannelCtxForPublish {
  organizationId: string;
  configId: string;
  platform: "dingtalk" | "wechat_work";
  chatId: string;
  externalUserId: string;
}

interface PendingPublish {
  articleId: string;
  articleTitle: string;
  catalogName: string;
  target: { catalogId: number; appId: number; siteId: number };
}

export async function handlePublishConfirm(
  session: ChannelSessionRow,
  channelCtx: ChannelCtxForPublish,
): Promise<{ reply: string }> {
  const pp = session.pendingPublish as PendingPublish | null;
  if (!pp) return { reply: "没有待发布的稿件。" };

  // 置 approved（仅 draft/reviewing）—— 直接 db.update，不经 requireAuth 的 updateArticleStatus
  await db
    .update(articles)
    .set({ status: "approved" })
    .where(
      and(
        eq(articles.id, pp.articleId),
        eq(articles.organizationId, channelCtx.organizationId),
        inArray(articles.status, ["draft", "reviewing"]),
      ),
    );

  try {
    const result = await publishArticleToCms({
      articleId: pp.articleId,
      operatorId: "channel_system",
      triggerSource: "manual",
      target: pp.target,
      allowUpdate: true,
    });

    const url = result.publishedUrl ?? result.previewUrl;
    const urlPart = url ? `：${url}` : "，已提交审核中";
    return { reply: `✅ 已发布到「${pp.catalogName}」${urlPart}` };
  } catch (err) {
    if (err instanceof CmsConfigError) {
      return { reply: "该组织未开启发布功能。" };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { reply: `发布失败：${msg}，可稍后重试。` };
  }
}
