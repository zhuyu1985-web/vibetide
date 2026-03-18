import { db } from "@/db";
import { reviewResults } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import type { ReviewResult } from "@/lib/types";

export async function getReviewResults(
  organizationId?: string
): Promise<ReviewResult[]> {
  const rows = await db.query.reviewResults.findMany({
    ...(organizationId
      ? { where: eq(reviewResults.organizationId, organizationId) }
      : {}),
    with: { reviewer: true },
    orderBy: [desc(reviewResults.createdAt)],
  });

  return rows.map((r) => ({
    id: r.id,
    contentId: r.contentId,
    contentType: r.contentType,
    reviewerEmployeeId: r.reviewerEmployeeId,
    reviewerName: r.reviewer?.name || undefined,
    status: r.status,
    issues: (r.issues as ReviewResult["issues"]) || [],
    score: r.score,
    channelRules: r.channelRules as ReviewResult["channelRules"],
    escalatedAt: r.escalatedAt?.toISOString(),
    escalationReason: r.escalationReason || undefined,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getReviewByContentId(
  contentId: string
): Promise<ReviewResult | null> {
  const row = await db.query.reviewResults.findFirst({
    where: eq(reviewResults.contentId, contentId),
    with: { reviewer: true },
    orderBy: [desc(reviewResults.createdAt)],
  });

  if (!row) return null;

  return {
    id: row.id,
    contentId: row.contentId,
    contentType: row.contentType,
    reviewerEmployeeId: row.reviewerEmployeeId,
    reviewerName: row.reviewer?.name || undefined,
    status: row.status,
    issues: (row.issues as ReviewResult["issues"]) || [],
    score: row.score,
    channelRules: row.channelRules as ReviewResult["channelRules"],
    escalatedAt: row.escalatedAt?.toISOString(),
    escalationReason: row.escalationReason || undefined,
    createdAt: row.createdAt.toISOString(),
  };
}
