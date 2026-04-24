"use server";

import { db } from "@/db";
import { missedTopics } from "@/db/schema";
import { userProfiles } from "@/db/schema/users";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { detectMissedTopicsForOrg } from "@/lib/topic-matching/missed-topic-finder";

async function requireUserAndOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("未登录");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("用户未关联组织");
  return { userId: user.id, orgId: profile.organizationId };
}

function revalidatePaths(id?: string) {
  revalidatePath("/missing-topics");
  if (id) revalidatePath(`/missing-topics/${id}`);
}

// ---------------------------------------------------------------------------
// 触发漏题识别（扫描对标 posts）
// ---------------------------------------------------------------------------

export async function runMissedTopicDetection(): Promise<{
  success: boolean;
  scanned?: number;
  created?: number;
  covered?: number;
  error?: string;
}> {
  try {
    const { orgId } = await requireUserAndOrg();
    const result = await detectMissedTopicsForOrg({ orgId, sinceDays: 14 });
    revalidatePaths();
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// 处置动作
// ---------------------------------------------------------------------------

export async function confirmMissedTopic(topicId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { userId, orgId } = await requireUserAndOrg();
    await db
      .update(missedTopics)
      .set({
        decision: "confirmed",
        confirmedBy: userId,
        confirmedAt: new Date(),
      })
      .where(
        and(eq(missedTopics.id, topicId), eq(missedTopics.organizationId, orgId))
      );
    revalidatePaths(topicId);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function excludeMissedTopic(input: {
  topicId: string;
  reasonCode: string;
  reasonText?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { orgId } = await requireUserAndOrg();
    await db
      .update(missedTopics)
      .set({
        decision: "excluded",
        excludedReasonCode: input.reasonCode,
        excludedReasonText: input.reasonText ?? null,
      })
      .where(
        and(
          eq(missedTopics.id, input.topicId),
          eq(missedTopics.organizationId, orgId)
        )
      );
    revalidatePaths(input.topicId);
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function markMissedTopicPushed(topicId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { orgId } = await requireUserAndOrg();
    const webhookUrl = process.env.MISSED_TOPIC_WEBHOOK_URL;
    if (!webhookUrl) {
      // Mock 模式：仅标记为 pushed
      await db
        .update(missedTopics)
        .set({
          pushStatus: "pushed",
          pushedAt: new Date(),
        })
        .where(
          and(
            eq(missedTopics.id, topicId),
            eq(missedTopics.organizationId, orgId)
          )
        );
      revalidatePaths(topicId);
      return { success: true };
    }
    // 真实推送（简化版）
    const [topic] = await db
      .select()
      .from(missedTopics)
      .where(
        and(eq(missedTopics.id, topicId), eq(missedTopics.organizationId, orgId))
      )
      .limit(1);
    if (!topic) return { success: false, error: "漏题不存在" };

    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: topic.title,
          heatScore: topic.heatScore,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await db
        .update(missedTopics)
        .set({
          pushStatus: "pushed",
          pushedAt: new Date(),
          pushErrorMessage: null,
        })
        .where(eq(missedTopics.id, topicId));
      revalidatePaths(topicId);
      return { success: true };
    } catch (e) {
      await db
        .update(missedTopics)
        .set({
          pushStatus: "push_failed",
          pushErrorMessage: (e as Error).message,
        })
        .where(eq(missedTopics.id, topicId));
      return { success: false, error: (e as Error).message };
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
