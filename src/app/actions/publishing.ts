"use server";

import { db } from "@/db";
import { channels, publishPlans } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
// TODO: re-implement message notifications via mission system
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

  // TODO: re-implement message notifications via mission system

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
