import { db } from "@/db";
import { hotTopics } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import type {
  InspirationTopic,
  PlatformMonitor,
  EditorialMeeting,
} from "@/lib/types";

export async function getInspirationTopics(
  orgId: string
): Promise<InspirationTopic[]> {
  const rows = await db.query.hotTopics.findMany({
    where: eq(hotTopics.organizationId, orgId),
    with: {
      angles: true,
      competitorResponses: true,
      commentInsights: true,
    },
    orderBy: [desc(hotTopics.heatScore)],
  });

  return rows.map((row) => {
    const insight = row.commentInsights[0];
    return {
      id: row.id,
      title: row.title,
      priority: row.priority,
      heatScore: row.heatScore,
      aiScore: Math.round(row.heatScore * 0.9 + Math.random() * 10),
      trend: row.trend,
      source: row.source || "",
      category: row.category || "",
      discoveredAt: row.discoveredAt.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      heatCurve: (row.heatCurve as { time: string; value: number }[]) || [],
      suggestedAngles: row.angles.map((a) => a.angleText),
      competitorResponse: row.competitorResponses.map(
        (r) => `${r.competitorName}：${r.responseType || ""}${r.views ? `（${r.views}）` : ""}`
      ),
      relatedAssets: [],
      summary: row.summary || "",
      platforms: (row.platforms as string[]) || [],
      commentInsight: insight
        ? {
            positive: insight.positive,
            neutral: insight.neutral,
            negative: insight.negative,
            hotComments: (insight.hotComments as string[]) || [],
          }
        : { positive: 0, neutral: 0, negative: 0, hotComments: [] },
    };
  });
}

export async function getHotTopic(
  id: string
): Promise<InspirationTopic | undefined> {
  const row = await db.query.hotTopics.findFirst({
    where: eq(hotTopics.id, id),
    with: {
      angles: true,
      competitorResponses: true,
      commentInsights: true,
    },
  });

  if (!row) return undefined;

  const insight = row.commentInsights[0];
  return {
    id: row.id,
    title: row.title,
    priority: row.priority,
    heatScore: row.heatScore,
    aiScore: Math.round(row.heatScore * 0.9 + Math.random() * 10),
    trend: row.trend,
    source: row.source || "",
    category: row.category || "",
    discoveredAt: row.discoveredAt.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    heatCurve: (row.heatCurve as { time: string; value: number }[]) || [],
    suggestedAngles: row.angles.map((a) => a.angleText),
    competitorResponse: row.competitorResponses.map(
      (r) => `${r.competitorName}：${r.responseType || ""}${r.views ? `（${r.views}）` : ""}`
    ),
    relatedAssets: [],
    summary: row.summary || "",
    platforms: (row.platforms as string[]) || [],
    commentInsight: insight
      ? {
          positive: insight.positive,
          neutral: insight.neutral,
          negative: insight.negative,
          hotComments: (insight.hotComments as string[]) || [],
        }
      : { positive: 0, neutral: 0, negative: 0, hotComments: [] },
  };
}

export function getPlatformMonitors(): PlatformMonitor[] {
  return [
    { name: "微博", icon: "📱", status: "online", lastScan: "10秒前", topicsFound: 12 },
    { name: "微信公众号", icon: "💬", status: "online", lastScan: "30秒前", topicsFound: 8 },
    { name: "抖音", icon: "🎵", status: "online", lastScan: "15秒前", topicsFound: 15 },
    { name: "头条", icon: "📰", status: "online", lastScan: "20秒前", topicsFound: 6 },
    { name: "知乎", icon: "💡", status: "online", lastScan: "45秒前", topicsFound: 4 },
    { name: "B站", icon: "📺", status: "online", lastScan: "25秒前", topicsFound: 7 },
    { name: "小红书", icon: "📕", status: "online", lastScan: "35秒前", topicsFound: 9 },
    { name: "百度", icon: "🔍", status: "online", lastScan: "50秒前", topicsFound: 3 },
    { name: "快手", icon: "⚡", status: "online", lastScan: "40秒前", topicsFound: 5 },
    { name: "今日头条", icon: "📲", status: "online", lastScan: "55秒前", topicsFound: 4 },
  ];
}

export function getEditorialMeeting(
  topics: InspirationTopic[]
): EditorialMeeting {
  const p0Count = topics.filter((t) => t.priority === "P0").length;
  const p1Count = topics.filter((t) => t.priority === "P1").length;
  const p2Count = topics.filter((t) => t.priority === "P2").length;

  return {
    p0Count,
    p1Count,
    p2Count,
    outputMatrix: [
      { type: "图文", count: p0Count * 2 + p1Count },
      { type: "短视频", count: p0Count * 3 + p1Count * 2 },
      { type: "H5专题", count: Math.max(1, Math.floor(p0Count / 2)) },
      { type: "直播", count: p0Count > 0 ? 1 : 0 },
    ],
    generatedAt: new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
