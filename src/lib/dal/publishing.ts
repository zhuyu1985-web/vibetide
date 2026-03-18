import { db } from "@/db";
import { channels, publishPlans, channelMetrics } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import type { ChannelConfig, PublishPlan, ChannelMetrics } from "@/lib/types";

export async function getChannels(
  organizationId?: string
): Promise<ChannelConfig[]> {
  const rows = await db.query.channels.findMany({
    ...(organizationId
      ? { where: eq(channels.organizationId, organizationId) }
      : {}),
    orderBy: [desc(channels.followers)],
  });

  return rows.map((ch) => ({
    id: ch.id,
    name: ch.name,
    platform: ch.platform,
    icon: ch.icon || "",
    followers: ch.followers,
    status: ch.status,
  }));
}

export async function getPublishPlans(
  organizationId?: string
): Promise<PublishPlan[]> {
  const rows = await db.query.publishPlans.findMany({
    ...(organizationId
      ? { where: eq(publishPlans.organizationId, organizationId) }
      : {}),
    with: {
      channel: true,
    },
    orderBy: [desc(publishPlans.scheduledAt)],
  });

  return rows.map((plan) => ({
    id: plan.id,
    taskId: plan.taskId || undefined,
    channelId: plan.channelId,
    channelName: plan.channel?.name,
    scheduledAt: plan.scheduledAt.toISOString(),
    publishedAt: plan.publishedAt?.toISOString(),
    status: plan.status,
    title: plan.title,
    adaptedContent: plan.adaptedContent || undefined,
  }));
}

export async function getChannelMetricsRange(
  organizationId?: string,
  startDate?: string,
  endDate?: string
): Promise<ChannelMetrics[]> {
  const conditions = [];
  if (organizationId)
    conditions.push(eq(channelMetrics.organizationId, organizationId));
  if (startDate) conditions.push(gte(channelMetrics.date, startDate));
  if (endDate) conditions.push(lte(channelMetrics.date, endDate));

  const rows = await db.query.channelMetrics.findMany({
    ...(conditions.length > 0 ? { where: and(...conditions) } : {}),
    with: {
      channel: true,
    },
    orderBy: [desc(channelMetrics.date)],
  });

  return rows.map((m) => ({
    id: m.id,
    channelId: m.channelId,
    channelName: m.channel?.name,
    date: m.date,
    views: m.views,
    likes: m.likes,
    shares: m.shares,
    comments: m.comments,
    followers: m.followers,
    engagement: m.engagement,
  }));
}
