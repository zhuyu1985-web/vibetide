import {
  getAnalyticsSummary,
  getChannelComparison,
  getTopContent,
  getSixDimensionScores,
  getViewsTrend,
  getAnomalyAlerts,
} from "@/lib/dal/analytics";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import AnalyticsClient from "./analytics-client";

export const dynamic = "force-dynamic";

function withTimeout<T>(promise: Promise<T>, fallback: T, ms = 5000): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export default async function AnalyticsPage() {
  const orgId = (await withTimeout(getCurrentUserOrg(), null)) || undefined;

  let stats: Awaited<ReturnType<typeof getAnalyticsSummary>> | null = null;
  let channelComparison: Awaited<ReturnType<typeof getChannelComparison>> = [];
  let topContent: Awaited<ReturnType<typeof getTopContent>> = [];
  let sixDimensionScores: Awaited<ReturnType<typeof getSixDimensionScores>> = [];
  let viewsTrend: Awaited<ReturnType<typeof getViewsTrend>> = [];
  let anomalyAlerts: Awaited<ReturnType<typeof getAnomalyAlerts>> = [];

  try {
    [stats, channelComparison, topContent, sixDimensionScores, viewsTrend, anomalyAlerts] =
      await Promise.all([
        withTimeout(getAnalyticsSummary(orgId), null),
        withTimeout(getChannelComparison(orgId), []),
        withTimeout(getTopContent(orgId), []),
        withTimeout(getSixDimensionScores(orgId), []),
        withTimeout(getViewsTrend(orgId), []),
        withTimeout(getAnomalyAlerts(orgId), []),
      ]);
  } catch (e) {
    console.error("[analytics] failed to load data:", e);
  }

  const defaultStats = {
    totalViews: 0,
    totalViewsChange: 0,
    avgEngagement: 0,
    avgEngagementChange: 0,
    totalFollowersGain: 0,
    totalFollowersGainChange: 0,
    contentPublished: 0,
    contentPublishedChange: 0,
    hitRate: 0,
    hitRateChange: 0,
    avgReadTime: "0:00",
  };

  return (
    <AnalyticsClient
      stats={stats ?? defaultStats}
      channelComparison={channelComparison}
      topContent={topContent}
      sixDimensionScores={sixDimensionScores}
      viewsTrend={viewsTrend}
      anomalyAlerts={anomalyAlerts}
    />
  );
}
