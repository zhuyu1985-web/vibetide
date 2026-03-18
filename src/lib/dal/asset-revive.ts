import { db } from "@/db";
import { reviveRecommendations, reviveRecords, mediaAssets } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";
import type {
  ReviveRecommendation, HotTopicMatch, ReviveMetrics,
  ReviveRecord, TrendDataPoint, ScenarioDistribution,
} from "@/lib/types";

export async function getDailyRecommendations(): Promise<ReviveRecommendation[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.reviveRecommendations.findMany({
    where: eq(reviveRecommendations.organizationId, orgId),
    orderBy: [desc(reviveRecommendations.createdAt)],
    with: { asset: true },
  });

  return rows.map((r) => ({
    id: r.id,
    scenario: r.scenario,
    originalAsset: r.asset?.title || "",
    reason: r.reason || "",
    matchScore: r.matchScore,
    matchedTopic: r.matchedTopic || "",
    suggestedAction: r.suggestedAction || "",
    estimatedReach: r.estimatedReach || "",
    status: r.status,
  }));
}

export async function getHotTopicMatches(): Promise<HotTopicMatch[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const recs = await db.query.reviveRecommendations.findMany({
    where: eq(reviveRecommendations.organizationId, orgId),
    with: { asset: true },
  });

  const topicMap = new Map<string, HotTopicMatch>();
  for (const r of recs) {
    if (!r.matchedTopic) continue;
    const existing = topicMap.get(r.matchedTopic);
    const matchItem = {
      assetTitle: r.asset?.title || "",
      matchScore: r.matchScore,
      suggestedAngle: r.suggestedAction || "",
    };
    if (existing) {
      existing.matchedAssets.push(matchItem);
    } else {
      topicMap.set(r.matchedTopic, {
        hotTopic: r.matchedTopic,
        heatScore: Math.round(r.matchScore * 100),
        matchedAssets: [matchItem],
      });
    }
  }

  return Array.from(topicMap.values());
}

export async function getReviveMetrics(): Promise<ReviveMetrics> {
  return {
    reuseRate: 34.2,
    reuseRateChange: 5.8,
    adoptionRate: 67.5,
    adoptionRateChange: 12.3,
    secondaryCreationCount: 156,
    secondaryCreationCountChange: 23,
    reachMultiplier: 3.2,
    reachMultiplierChange: 0.5,
  };
}

export async function getReviveRecords(): Promise<ReviveRecord[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.reviveRecords.findMany({
    where: eq(reviveRecords.organizationId, orgId),
    orderBy: [desc(reviveRecords.createdAt)],
    with: { asset: true },
  });

  return rows.map((r) => ({
    id: r.id,
    asset: r.asset?.title || "",
    scenario: r.scenario,
    matchScore: 0,
    status: r.status || "pending",
    date: r.createdAt.toISOString(),
    reach: r.resultReach || 0,
  }));
}

export async function getReviveTrend(days: number): Promise<TrendDataPoint[]> {
  const points: TrendDataPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    points.push({
      date: d.toISOString().slice(0, 10),
      value: Math.floor(Math.random() * 20) + 10,
    });
  }
  return points;
}

export async function getScenarioDistribution(): Promise<ScenarioDistribution[]> {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return [];

  const rows = await db.query.reviveRecommendations.findMany({
    where: eq(reviveRecommendations.organizationId, orgId),
  });

  const dist = new Map<string, number>();
  const labels: Record<string, string> = {
    topic_match: "选题匹配",
    hot_match: "热点匹配",
    daily_push: "日常推送",
    intl_broadcast: "国际传播",
    style_adapt: "风格改编",
  };
  for (const r of rows) {
    const name = labels[r.scenario] || r.scenario;
    dist.set(name, (dist.get(name) || 0) + 1);
  }

  return Array.from(dist.entries()).map(([name, value]) => ({ name, value }));
}
