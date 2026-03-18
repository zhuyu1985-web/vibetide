"use server";

import { db } from "@/db";
import {
  hotTopics,
  topicAngles,
  commentInsights,
  teams,
  teamMembers,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createHotTopic(data: {
  organizationId: string;
  title: string;
  priority?: "P0" | "P1" | "P2";
  heatScore?: number;
  trend?: "rising" | "surging" | "plateau" | "declining";
  source?: string;
  category?: string;
  summary?: string;
  heatCurve?: { time: string; value: number }[];
  platforms?: string[];
}) {
  await requireAuth();

  const [topic] = await db
    .insert(hotTopics)
    .values(data)
    .returning();

  revalidatePath("/inspiration");
  return topic;
}

export async function updateTopicPriority(
  id: string,
  priority: "P0" | "P1" | "P2"
) {
  await requireAuth();

  await db
    .update(hotTopics)
    .set({ priority, updatedAt: new Date() })
    .where(eq(hotTopics.id, id));

  revalidatePath("/inspiration");
}

export async function startTopicTracking(id: string) {
  await requireAuth();

  // Update the topic to P0 to signal tracking
  await db
    .update(hotTopics)
    .set({ priority: "P0", updatedAt: new Date() })
    .where(eq(hotTopics.id, id));

  revalidatePath("/inspiration");
  revalidatePath("/team-hub");
}

export async function addTopicAngle(data: {
  hotTopicId: string;
  angleText: string;
  generatedBy?: string;
}) {
  await requireAuth();

  await db.insert(topicAngles).values(data);

  revalidatePath("/inspiration");
}

export async function updateCommentInsight(data: {
  hotTopicId: string;
  positive: number;
  neutral: number;
  negative: number;
  hotComments?: string[];
}) {
  await requireAuth();

  // Upsert: check if insight exists for this topic
  const existing = await db.query.commentInsights.findFirst({
    where: eq(commentInsights.hotTopicId, data.hotTopicId),
  });

  if (existing) {
    await db
      .update(commentInsights)
      .set({
        positive: data.positive,
        neutral: data.neutral,
        negative: data.negative,
        hotComments: data.hotComments || [],
        analyzedAt: new Date(),
      })
      .where(eq(commentInsights.id, existing.id));
  } else {
    await db.insert(commentInsights).values({
      hotTopicId: data.hotTopicId,
      positive: data.positive,
      neutral: data.neutral,
      negative: data.negative,
      hotComments: data.hotComments || [],
    });
  }

  revalidatePath("/inspiration");
}

const AUTO_TRIGGER_HEAT_THRESHOLD = 80;

/**
 * F4.A.02: Update a topic's heat score and auto-trigger workflow if threshold reached.
 */
export async function updateTopicHeatScore(
  id: string,
  heatScore: number,
  organizationId: string
) {
  await requireAuth();

  await db
    .update(hotTopics)
    .set({ heatScore, updatedAt: new Date() })
    .where(eq(hotTopics.id, id));

  // Auto-trigger workflow when heat exceeds threshold
  if (heatScore >= AUTO_TRIGGER_HEAT_THRESHOLD) {
    const topic = await db.query.hotTopics.findFirst({
      where: eq(hotTopics.id, id),
    });
    if (!topic) return;

    // Find the first team in this organization
    const team = await db.query.teams.findFirst({
      where: eq(teams.organizationId, organizationId),
    });

    if (team) {
      await inngest.send({
        name: "hotTopic/threshold-reached",
        data: {
          organizationId,
          hotTopicId: id,
          topicTitle: topic.title,
          heatScore,
          teamId: team.id,
        },
      });
    }
  }

  revalidatePath("/inspiration");
  revalidatePath("/team-hub");
}
