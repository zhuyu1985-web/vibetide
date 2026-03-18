export const dynamic = "force-dynamic";

import {
  getDailyRecommendations,
  getHotTopicMatches,
  getReviveMetrics,
  getReviveRecords,
  getReviveTrend,
  getScenarioDistribution,
} from "@/lib/dal/asset-revive";
import AssetReviveClient from "./asset-revive-client";

export default async function AssetRevivePage() {
  const [recommendations, hotMatches, metrics, records, trend, scenarioDist] =
    await Promise.all([
      getDailyRecommendations().catch(() => []),
      getHotTopicMatches().catch(() => []),
      getReviveMetrics().catch(() => ({ reuseRate: 0, reuseRateChange: 0, adoptionRate: 0, adoptionRateChange: 0, secondaryCreationCount: 0, secondaryCreationCountChange: 0, reachMultiplier: 0, reachMultiplierChange: 0 })),
      getReviveRecords().catch(() => []),
      getReviveTrend(7).catch(() => []),
      getScenarioDistribution().catch(() => []),
    ]);

  return (
    <AssetReviveClient
      recommendations={recommendations}
      hotMatches={hotMatches}
      metrics={metrics}
      records={records}
      trend={trend}
      scenarioDist={scenarioDist}
    />
  );
}
