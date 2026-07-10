import { db } from "@/db";
import { reviewResults, type ReviewImThread } from "@/db/schema/reviews";
import { articles } from "@/db/schema/articles";
import { userProfiles } from "@/db/schema/users";
import { and, count, desc, eq, isNotNull } from "drizzle-orm";
import {
  listConversationsByUser,
  createConversation,
  appendMessage,
} from "@/lib/dal/cowork-conversations";

export type ReviewDecision = "approved" | "rejected";

export interface ReviewerCandidate {
  userId: string;
  displayName: string;
  role: string;
  pendingCount: number;
}

/** 列出本 org 可当审核人的真人用户（启用账号），附待审条数（少的排前）。 */
export async function listReviewerCandidates(
  orgId: string,
): Promise<ReviewerCandidate[]> {
  const users = await db
    .select({
      id: userProfiles.id,
      displayName: userProfiles.displayName,
      role: userProfiles.role,
    })
    .from(userProfiles)
    .where(
      and(
        eq(userProfiles.organizationId, orgId),
        isNotNull(userProfiles.passwordHash), // 停用账号 hash=NULL，排除
      ),
    );

  const counts = await db
    .select({ uid: reviewResults.assigneeUserId, c: count() })
    .from(reviewResults)
    .where(
      and(
        eq(reviewResults.organizationId, orgId),
        eq(reviewResults.status, "pending"),
        isNotNull(reviewResults.assigneeUserId),
      ),
    )
    .groupBy(reviewResults.assigneeUserId);
  const countMap = new Map(counts.map((r) => [r.uid, Number(r.c)]));

  return users
    .map((u) => ({
      userId: u.id,
      displayName: u.displayName,
      role: u.role,
      pendingCount: countMap.get(u.id) ?? 0,
    }))
    .sort((a, b) => a.pendingCount - b.pendingCount);
}

/** 建审核任务（pending）+ 把稿件置 reviewing。 */
export async function createReviewForArticle(input: {
  orgId: string;
  articleId: string;
  assigneeUserId: string;
  imThread?: ReviewImThread;
  reviewerEmployeeId?: string | null;
  issues?: {
    type: string;
    severity: "high" | "medium" | "low";
    location: string;
    description: string;
    suggestion: string;
    resolved: boolean;
  }[];
  score?: number;
}) {
  const [row] = await db
    .insert(reviewResults)
    .values({
      organizationId: input.orgId,
      contentId: input.articleId,
      contentType: "article",
      reviewerEmployeeId: input.reviewerEmployeeId ?? null,
      assigneeUserId: input.assigneeUserId,
      imThread: input.imThread ?? null,
      status: "pending",
      issues: input.issues ?? [],
      score: input.score,
    })
    .returning();

  await db
    .update(articles)
    .set({ status: "reviewing", updatedAt: new Date() })
    .where(eq(articles.id, input.articleId));

  return row;
}

/** 查某审核人最新的待审任务（intent-execute 短路用）。 */
export async function getPendingReviewForAssignee(userId: string, orgId: string) {
  const row = await db.query.reviewResults.findFirst({
    where: and(
      eq(reviewResults.assigneeUserId, userId),
      eq(reviewResults.organizationId, orgId),
      eq(reviewResults.status, "pending"),
    ),
    orderBy: [desc(reviewResults.createdAt)],
  });
  return row ?? null;
}

export interface ReviewResolveResult {
  reviewId: string;
  articleId: string;
  decision: ReviewDecision;
  reason?: string;
  imThread: ReviewImThread | null;
}

/**
 * 真人审核决定落库（纯函数，无 auth）：写 decision/decided_at/留痕 + 回写稿件状态。
 * 通过→article=approved；驳回→article=draft（回改稿循环）。返回 imThread 供回链作者。
 */
export async function resolveReviewCore(
  reviewId: string,
  decision: ReviewDecision,
  reason?: string,
  reviewerTurn?: string,
): Promise<ReviewResolveResult | null> {
  const review = await db.query.reviewResults.findFirst({
    where: eq(reviewResults.id, reviewId),
  });
  if (!review) return null;

  const now = new Date();
  const turns = [
    ...((review.decisionTurns as { role: string; content: string; at: string }[]) ?? []),
  ];
  if (reviewerTurn) {
    turns.push({ role: "reviewer", content: reviewerTurn, at: now.toISOString() });
  }

  await db
    .update(reviewResults)
    .set({
      status: decision,
      decision,
      decisionReason: reason ?? null,
      decidedAt: now,
      decisionTurns: turns,
    })
    .where(eq(reviewResults.id, reviewId));

  await db
    .update(articles)
    .set({
      status: decision === "approved" ? "approved" : "draft",
      updatedAt: now,
    })
    .where(eq(articles.id, review.contentId));

  return {
    reviewId,
    articleId: review.contentId,
    decision,
    reason,
    imThread: (review.imThread as ReviewImThread | null) ?? null,
  };
}

/**
 * 把审核任务卡投递到审核人的 cowork 个人对话窗（找最近活跃会话，无则新建），
 * 并回填 review.imThread.reviewer。返回投递的 conversationId。
 */
export async function deliverReviewToReviewerCowork(
  orgId: string,
  reviewerUserId: string,
  reviewId: string,
  card: string,
): Promise<string | null> {
  try {
    const convos = await listConversationsByUser(orgId, reviewerUserId, {});
    let conversationId = convos[0]?.id;
    if (!conversationId) {
      const created = await createConversation(orgId, reviewerUserId, {
        title: "审核任务",
      });
      conversationId = created.id;
    }
    await appendMessage(conversationId, {
      role: "assistant",
      content: card,
      kind: "text",
    });

    const review = await db.query.reviewResults.findFirst({
      where: eq(reviewResults.id, reviewId),
    });
    const imThread = (review?.imThread as ReviewImThread | null) ?? {};
    await db
      .update(reviewResults)
      .set({
        imThread: {
          ...imThread,
          reviewer: { kind: "cowork", userId: reviewerUserId, conversationId },
        },
      })
      .where(eq(reviewResults.id, reviewId));
    return conversationId;
  } catch (err) {
    console.error("[review] 投递审核卡到 cowork 失败:", err);
    return null;
  }
}
