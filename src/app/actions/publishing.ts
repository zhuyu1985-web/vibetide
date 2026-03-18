"use server";

import { db } from "@/db";
import { channels, publishPlans } from "@/db/schema";
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

// --- Channel Management (F3.1.07) ---

export async function createChannel(data: {
  name: string;
  platform: string;
  icon?: string;
  followers?: number;
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(channels)
    .values({
      organizationId: orgId,
      name: data.name,
      platform: data.platform,
      icon: data.icon || "",
      followers: data.followers || 0,
      status: "setup",
    })
    .returning();

  revalidatePath("/publishing");
  return row;
}

export async function updateChannelStatus(
  channelId: string,
  status: "active" | "paused" | "setup"
) {
  await requireAuth();

  await db
    .update(channels)
    .set({ status, updatedAt: new Date() })
    .where(eq(channels.id, channelId));

  revalidatePath("/publishing");
}

export async function deleteChannel(channelId: string) {
  await requireAuth();

  await db.delete(channels).where(eq(channels.id, channelId));

  revalidatePath("/publishing");
}

// --- Publish Plans (F3.1.01-06) ---

export async function createPublishPlan(data: {
  channelId: string;
  taskId?: string;
  title: string;
  scheduledAt: string;
  adaptedContent?: {
    headline?: string;
    body?: string;
    coverImage?: string;
    tags?: string[];
    format?: string;
  };
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(publishPlans)
    .values({
      organizationId: orgId,
      channelId: data.channelId,
      taskId: data.taskId || null,
      title: data.title,
      scheduledAt: new Date(data.scheduledAt),
      adaptedContent: data.adaptedContent,
      status: "scheduled",
    })
    .returning();

  revalidatePath("/publishing");
  return row;
}

export async function updatePublishPlanStatus(
  planId: string,
  status: "scheduled" | "publishing" | "published" | "failed"
) {
  await requireAuth();

  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "published") {
    updates.publishedAt = new Date();
  }

  await db
    .update(publishPlans)
    .set(updates)
    .where(eq(publishPlans.id, planId));

  // Post team message per Section 七
  if (status === "published" || status === "failed") {
    const plan = await db.query.publishPlans.findFirst({
      where: eq(publishPlans.id, planId),
      with: { channel: true },
    });

    if (plan) {
      const channelName = plan.channel?.name || "未知渠道";
      if (status === "published") {
        await postTeamMessage({
          senderSlug: "xiaofa",
          type: "work_output",
          content: `已发布至${channelName}：${plan.title}`,
        });
      } else {
        await postTeamMessage({
          senderSlug: "xiaofa",
          type: "alert",
          content: `${channelName}发布失败：${plan.title}`,
        });
      }
    }
  }

  revalidatePath("/publishing");
  revalidatePath("/analytics");
}

export async function deletePublishPlan(planId: string) {
  await requireAuth();

  await db.delete(publishPlans).where(eq(publishPlans.id, planId));

  revalidatePath("/publishing");
}

export async function reschedulePublishPlan(
  planId: string,
  newScheduledAt: string
) {
  await requireAuth();

  await db
    .update(publishPlans)
    .set({
      scheduledAt: new Date(newScheduledAt),
      updatedAt: new Date(),
    })
    .where(eq(publishPlans.id, planId));

  revalidatePath("/publishing");
}
