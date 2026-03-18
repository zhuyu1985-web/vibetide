import { db } from "@/db";
import { batchJobs, batchItems, conversionTasks } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type {
  BatchTopic,
  BatchStats,
  ConversionTaskItem,
  DigitalHumanConfig,
} from "@/lib/types";

export async function getBatchTopics(
  orgId: string
): Promise<BatchTopic[]> {
  const rows = await db.query.batchJobs.findMany({
    where: eq(batchJobs.organizationId, orgId),
    with: {
      items: true,
    },
    orderBy: [desc(batchJobs.createdAt)],
  });

  return rows.map((row) => {
    const totalItems = row.items.length || row.totalItems;
    const doneItems = row.items.filter((i) => i.status === "done").length;
    const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    return {
      id: row.id,
      title: row.goalDescription,
      progress,
      channels: row.items.map((item) => ({
        channel: item.channel || "",
        status: item.status === "done"
          ? ("done" as const)
          : item.status === "processing"
            ? ("processing" as const)
            : ("pending" as const),
        format: item.format || "",
      })),
    };
  });
}

export async function getBatchStats(
  orgId: string
): Promise<BatchStats> {
  const rows = await db
    .select({
      status: batchItems.status,
      count: sql<number>`count(*)::int`,
    })
    .from(batchItems)
    .innerJoin(batchJobs, eq(batchItems.batchJobId, batchJobs.id))
    .where(eq(batchJobs.organizationId, orgId))
    .groupBy(batchItems.status);

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = row.count;
  }

  return {
    todayOutput: (counts["done"] || 0) + (counts["processing"] || 0),
    inProgress: counts["processing"] || 0,
    published: counts["done"] || 0,
    pendingReview: counts["pending"] || 0,
  };
}

export async function getConversionTasks(
  orgId: string
): Promise<ConversionTaskItem[]> {
  const rows = await db.query.conversionTasks.findMany({
    where: eq(conversionTasks.organizationId, orgId),
    orderBy: [desc(conversionTasks.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    title: `${row.sourceRatio} -> ${row.targetRatio}`,
    sourceRatio: row.sourceRatio,
    targetRatio: row.targetRatio,
    status: row.status === "done"
      ? ("done" as const)
      : row.status === "processing"
        ? ("processing" as const)
        : ("pending" as const),
    settings: (row.settings as ConversionTaskItem["settings"]) || {
      smartFocus: false,
      facePriority: false,
      subtitleReflow: false,
    },
  }));
}

export function getChannelAdaptations() {
  return [
    {
      channel: "微信视频号",
      icon: "💬",
      format: "竖版短视频",
      ratio: "9:16",
      duration: "30-60s",
      style: "信息密集+字幕大号",
      status: "done" as const,
    },
    {
      channel: "抖音",
      icon: "🎵",
      format: "竖版短视频",
      ratio: "9:16",
      duration: "15-30s",
      style: "节奏快+热门BGM",
      status: "done" as const,
    },
    {
      channel: "微博",
      icon: "📱",
      format: "横版视频",
      ratio: "16:9",
      duration: "60-120s",
      style: "深度解读+数据图表",
      status: "processing" as const,
    },
    {
      channel: "头条",
      icon: "📰",
      format: "横版视频",
      ratio: "16:9",
      duration: "90-180s",
      style: "完整叙事+专业感",
      status: "pending" as const,
    },
  ];
}

export function getDigitalHumans(): DigitalHumanConfig[] {
  return [
    { id: "dh-1", name: "小新", avatar: "新", style: "formal", voiceType: "标准男声" },
    { id: "dh-2", name: "小悦", avatar: "悦", style: "friendly", voiceType: "亲切女声" },
    { id: "dh-3", name: "小动", avatar: "动", style: "energetic", voiceType: "活力男声" },
  ];
}
