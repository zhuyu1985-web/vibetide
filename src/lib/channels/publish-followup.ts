/**
 * IM 发布 follow-up — 在 confirming 态由用户回"确认"后调用。
 * 先将稿件置 approved（仅 draft/reviewing），再调 publishArticleToCms。
 * 发布失败时回滚稿件状态，避免稿件被悄悄抬到 approved 绕过审核且与 CMS 脱节。
 */

import { and, eq } from "drizzle-orm";
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
): Promise<{ reply: string; ok: boolean }> {
  const pp = session.pendingPublish as PendingPublish | null;
  if (!pp) return { reply: "没有待发布的稿件。", ok: false };

  // 读原状态以便失败回滚
  const cur = await db
    .select({ status: articles.status })
    .from(articles)
    .where(
      and(
        eq(articles.id, pp.articleId),
        eq(articles.organizationId, channelCtx.organizationId),
      ),
    )
    .limit(1);
  const origStatus = cur[0]?.status;
  const bumped = origStatus === "draft" || origStatus === "reviewing";

  // 置 approved（仅 draft/reviewing）—— 直接 db.update，不经 requireAuth 的 updateArticleStatus。
  // publishArticleToCms 门槛要求 approved，所以先 bump 再 publish。
  if (bumped) {
    await db
      .update(articles)
      .set({ status: "approved" })
      .where(
        and(
          eq(articles.id, pp.articleId),
          eq(articles.organizationId, channelCtx.organizationId),
        ),
      );
  }

  try {
    const result = await publishArticleToCms({
      articleId: pp.articleId,
      operatorId: "channel_system",
      triggerSource: "manual",
      target: pp.target,
      allowUpdate: true,
    });

    const url = result.publishedUrl ?? result.previewUrl ?? "已提交，审核中";
    return { reply: `✅ 已发布到「${pp.catalogName}」：${url}`, ok: true };
  } catch (err) {
    // 失败回滚：把我们刚抬上去的状态还原，避免稿件停在 approved 与 CMS 脱节
    if (bumped && origStatus) {
      await db
        .update(articles)
        .set({ status: origStatus })
        .where(
          and(
            eq(articles.id, pp.articleId),
            eq(articles.organizationId, channelCtx.organizationId),
          ),
        );
    }
    if (err instanceof CmsConfigError) {
      return { reply: "该组织未开启发布功能。", ok: false };
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { reply: `发布失败：${msg}，可稍后回复 确认 重试。`, ok: false };
  }
}
