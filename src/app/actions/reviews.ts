"use server";

import { db } from "@/db";
import { reviewResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { postTeamMessage } from "@/lib/dal/team-messages";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

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

  // Post team message per Section 七
  const review = await db.query.reviewResults.findFirst({
    where: eq(reviewResults.id, reviewId),
  });

  if (review) {
    if (status === "approved") {
      await postTeamMessage({
        senderSlug: "xiaoshen",
        type: "status_update",
        content: `内容《${review.contentId}》审核通过${review.score ? `，审核评分 ${review.score}` : ""}`,
        attachments: [{ type: "draft_preview", title: review.contentId }],
      });
    } else if (status === "rejected") {
      await postTeamMessage({
        senderSlug: "xiaoshen",
        type: "decision_request",
        content: `内容《${review.contentId}》审核驳回，请确认处理方式`,
        actions: [
          { label: "退回修改", variant: "default" },
          { label: "人工审核", variant: "primary" },
        ],
      });
    } else if (status === "escalated") {
      await postTeamMessage({
        senderSlug: "xiaoshen",
        type: "alert",
        content: `检测到敏感内容，已升级人工审核：${review.contentId}${escalationReason ? `（${escalationReason}）` : ""}`,
      });
    }
  }

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
