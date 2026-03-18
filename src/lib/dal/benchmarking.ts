import { db } from "@/db";
import {
  benchmarkAnalyses,
  missedTopics,
  weeklyReports,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type {
  BenchmarkTopic,
  MissedTopic,
  WeeklyReport,
} from "@/lib/types";

export async function getBenchmarkTopics(
  orgId: string
): Promise<BenchmarkTopic[]> {
  const rows = await db.query.benchmarkAnalyses.findMany({
    where: eq(benchmarkAnalyses.organizationId, orgId),
    orderBy: [desc(benchmarkAnalyses.analyzedAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.topicTitle,
    category: row.category || "",
    mediaScores:
      (row.mediaScores as BenchmarkTopic["mediaScores"]) || [],
    radarData: (row.radarData as BenchmarkTopic["radarData"]) || [],
    improvements: (row.improvements as string[]) || [],
  }));
}

export async function getMissedTopics(
  orgId: string
): Promise<MissedTopic[]> {
  const rows = await db.query.missedTopics.findMany({
    where: eq(missedTopics.organizationId, orgId),
    orderBy: [desc(missedTopics.discoveredAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    priority: row.priority,
    discoveredAt: row.discoveredAt.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    competitors: (row.competitors as string[]) || [],
    heatScore: row.heatScore || 0,
    category: row.category || "",
    type: row.type,
    status: row.status,
  }));
}

export async function getWeeklyReport(
  orgId: string
): Promise<WeeklyReport | null> {
  const row = await db.query.weeklyReports.findFirst({
    where: eq(weeklyReports.organizationId, orgId),
    orderBy: [desc(weeklyReports.createdAt)],
  });

  if (!row) return null;

  return {
    period: row.period,
    overallScore: row.overallScore || 0,
    missedRate: row.missedRate || 0,
    responseSpeed: row.responseSpeed || "",
    coverageRate: row.coverageRate || 0,
    trends: (row.trends as WeeklyReport["trends"]) || [],
    gapList: (row.gapList as WeeklyReport["gapList"]) || [],
  };
}

export async function getMissedTypeDistribution(
  orgId: string
): Promise<{ name: string; value: number; color: string }[]> {
  const rows = await db
    .select({
      type: missedTopics.type,
      count: sql<number>`count(*)::int`,
    })
    .from(missedTopics)
    .where(eq(missedTopics.organizationId, orgId))
    .groupBy(missedTopics.type);

  const colorMap: Record<string, { name: string; color: string }> = {
    breaking: { name: "突发新闻", color: "#ef4444" },
    trending: { name: "趋势话题", color: "#f59e0b" },
    analysis: { name: "深度分析", color: "#3b82f6" },
  };

  return rows.map((row) => ({
    name: colorMap[row.type]?.name || row.type,
    value: row.count,
    color: colorMap[row.type]?.color || "#6b7280",
  }));
}

export function getBenchmarkDimensions(): string[] {
  return ["叙事角度", "视觉品质", "互动策略", "时效性"];
}
