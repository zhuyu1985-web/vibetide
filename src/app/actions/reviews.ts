"use server";

import { db } from "@/db";
import { reviewResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
// TODO: re-implement message notifications via mission system
export async function createReviewResult(data: {
  contentId: string;
  contentType?: string;
  reviewerEmployeeId: string;
  status?: "pending" | "approved" | "rejected" | "escalated";
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
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(reviewResults)
    .values({
      organizationId: orgId,
      contentId: data.contentId,
      contentType: data.contentType || "article",
      reviewerEmployeeId: data.reviewerEmployeeId,
      status: data.status || "pending",
      issues: data.issues || [],
      score: data.score,
    })
    .returning();

  revalidatePath("/publishing");
  return row;
}

export async function updateReviewStatus(
  reviewId: string,
  status: "pending" | "approved" | "rejected" | "escalated",
  escalationReason?: string
) {
  await requireAuth();

  const updates: Record<string, unknown> = { status };

  if (status === "escalated") {
    updates.escalatedAt = new Date();
    if (escalationReason) updates.escalationReason = escalationReason;
  }

  await db
    .update(reviewResults)
    .set(updates)
    .where(eq(reviewResults.id, reviewId));

  // TODO: re-implement message notifications via mission system

  revalidatePath("/publishing");
}

export async function resolveReviewIssue(
  reviewId: string,
  issueIndex: number
) {
  await requireAuth();

  const review = await db.query.reviewResults.findFirst({
    where: eq(reviewResults.id, reviewId),
  });

  if (!review || !review.issues) return;

  const issues = [...(review.issues as { type: string; severity: "high" | "medium" | "low"; location: string; description: string; suggestion: string; resolved: boolean }[])];
  if (issueIndex >= 0 && issueIndex < issues.length) {
    issues[issueIndex] = { ...issues[issueIndex], resolved: true };
  }

  await db
    .update(reviewResults)
    .set({ issues })
    .where(eq(reviewResults.id, reviewId));

  revalidatePath("/publishing");
}
