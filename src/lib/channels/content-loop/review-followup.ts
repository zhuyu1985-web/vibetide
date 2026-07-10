/**
 * 审核决策解析 + 结果回链作者。
 *
 * 审核人在 cowork 对话窗说"通过/驳回" → intent-execute 顶部短路调用这里 →
 * resolveReviewCore 落库 → 把结果推回作者 IM（im_thread.author）+ 推进作者会话：
 * 通过→approved 阶段；驳回→回 drafting 改稿循环。
 */
import { db } from "@/db";
import { articles } from "@/db/schema/articles";
import { eq } from "drizzle-orm";
import { getChannelConfig } from "@/lib/dal/channels";
import { sendChannelMessage } from "@/lib/channels/outbound";
import {
  getSessionById,
  updateSession,
  CONTENT_LOOP_TTL_MS,
} from "@/lib/dal/channel-sessions";
import {
  resolveReviewCore,
  type ReviewDecision,
} from "@/lib/dal/review-results";
import type { ContentLoopContext } from "@/db/schema/channel-sessions";

/** 从审核人的话里识别"通过/驳回"+理由。驳回优先（避免"不通过"被误判通过）。 */
export function detectReviewDecision(
  text: string,
): { decision: ReviewDecision; reason?: string } | null {
  const t = text.trim();
  if (/(驳回|打回|退回|不通过|不予通过|拒绝|需修改|要修改|打back)/.test(t)) {
    const m = t.match(/(?:驳回|打回|退回|拒绝)[，,：:、\s]*(.+)$/);
    const reason = m?.[1]?.trim();
    return { decision: "rejected", reason: reason || undefined };
  }
  if (/(通过|同意|批准|可以发|没问题|放行|过了|approve)/i.test(t)) {
    return { decision: "approved" };
  }
  return null;
}

async function getArticleTitle(articleId: string): Promise<string> {
  const a = await db.query.articles.findFirst({
    where: eq(articles.id, articleId),
    columns: { title: true },
  });
  return a?.title ?? "稿件";
}

/** 把审核结果推回作者 IM + 推进作者会话阶段。 */
async function notifyAuthorOfReviewResult(
  result: NonNullable<Awaited<ReturnType<typeof resolveReviewCore>>>,
  title: string,
): Promise<void> {
  const author = result.imThread?.author;
  if (!author) return;

  const content =
    result.decision === "approved"
      ? `✅ 你的稿件《${title}》已通过审核，可以发布了。说「发到X渠道」开始（发布功能即将上线）。`
      : `❌ 审核驳回《${title}》${result.reason ? "：" + result.reason : ""}。已放回草稿，直接说怎么改，比如「第二段补一下数据来源」。`;

  try {
    const config = await getChannelConfig(author.configId);
    if (config) {
      await sendChannelMessage({
        config,
        chatId: author.chatId,
        type: "markdown",
        title: "审核结果",
        content,
      });
    }
  } catch (err) {
    console.error("[review] 回链作者 IM 失败:", err);
  }

  // 推进作者会话
  if (!author.channelSessionId) return;
  const s = await getSessionById(author.channelSessionId);
  if (!s) return;
  const ctx = (s.loopContext ?? {}) as ContentLoopContext;
  const expiresAt = new Date(Date.now() + CONTENT_LOOP_TTL_MS);
  if (result.decision === "approved") {
    await updateSession(s.id, {
      scenarioPhase: "approved",
      loopContext: { ...ctx, reviewId: undefined },
      expiresAt,
    });
  } else {
    // 驳回 → 回到改稿循环，锚定被审稿件
    await updateSession(s.id, {
      scenarioPhase: "drafting",
      lastArticleId: result.articleId,
      loopContext: { ...ctx, reviewId: undefined },
      expiresAt,
    });
  }
}

export interface ReviewDecisionOutcome {
  ok: boolean;
  articleTitle: string;
  decision: ReviewDecision;
  reason?: string;
}

/** 落库审核决定 + 回链作者，返回给审核人侧的确认信息。 */
export async function resolveAndNotify(
  reviewId: string,
  decision: ReviewDecision,
  reason: string | undefined,
  reviewerTurn: string,
): Promise<ReviewDecisionOutcome> {
  const result = await resolveReviewCore(reviewId, decision, reason, reviewerTurn);
  if (!result) {
    return { ok: false, articleTitle: "", decision, reason };
  }
  const title = await getArticleTitle(result.articleId);
  await notifyAuthorOfReviewResult(result, title);
  return { ok: true, articleTitle: title, decision, reason };
}
