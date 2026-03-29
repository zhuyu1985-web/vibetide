export const dynamic = "force-dynamic";

import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getBenchmarkTopics,
  getMissedTopics,
  getWeeklyReport,
  getMissedTypeDistribution,
  getBenchmarkDimensions,
  getMonitoredPlatforms,
  getRecentPlatformContent,
  getBenchmarkAlerts,
  getAlertStats,
  getUnreadAlertCount,
  getCoverageOverview,
  getMultiPlatformComparison,
  getTopicCandidates,
  autoGenerateAnalysisIfNeeded,
} from "@/lib/dal/benchmarking";
import type { TopicCandidate } from "@/lib/dal/benchmarking";
import { initializeDefaultPlatforms } from "@/app/actions/benchmarking";
import { BenchmarkingClient } from "./benchmarking-client";

export default async function BenchmarkingPage() {
  let benchmarkTopics: Awaited<ReturnType<typeof getBenchmarkTopics>> = [];
  let missedTopics: Awaited<ReturnType<typeof getMissedTopics>> = [];
  let weeklyReport: Awaited<ReturnType<typeof getWeeklyReport>> | null = null;
  let missedTypeDistribution: Awaited<ReturnType<typeof getMissedTypeDistribution>> = [];
  let platforms: Awaited<ReturnType<typeof getMonitoredPlatforms>> = [];
  let recentContent: Awaited<ReturnType<typeof getRecentPlatformContent>> = [];
  let alerts: Awaited<ReturnType<typeof getBenchmarkAlerts>> = [];
  let alertStats: Awaited<ReturnType<typeof getAlertStats>> = { total: 0, urgent: 0, high: 0, new: 0, actioned: 0 };
  let unreadAlertCount = 0;
  let coverageOverview: Awaited<ReturnType<typeof getCoverageOverview>> = { totalExternal: 0, covered: 0, missed: 0, coverageRate: 0, byPlatformCategory: [] };
  let multiPlatformComparison: Awaited<ReturnType<typeof getMultiPlatformComparison>> = [];
  let topicCandidates: TopicCandidate[] = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      // Auto-initialize default platforms on first visit
      await initializeDefaultPlatforms(orgId);

      // Auto-generate analysis data if content exists but analyses don't
      await autoGenerateAnalysisIfNeeded(orgId);

      [
        benchmarkTopics,
        missedTopics,
        weeklyReport,
        missedTypeDistribution,
        platforms,
        recentContent,
        alerts,
        alertStats,
        unreadAlertCount,
        coverageOverview,
        multiPlatformComparison,
        topicCandidates,
      ] = await Promise.all([
        getBenchmarkTopics(orgId),
        getMissedTopics(orgId),
        getWeeklyReport(orgId),
        getMissedTypeDistribution(orgId),
        getMonitoredPlatforms(orgId),
        getRecentPlatformContent(orgId),
        getBenchmarkAlerts(orgId),
        getAlertStats(orgId),
        getUnreadAlertCount(orgId),
        getCoverageOverview(orgId),
        getMultiPlatformComparison(orgId),
        getTopicCandidates(orgId),
      ]);
    }
  } catch {
    // Gracefully degrade when DB is unavailable
  }

  const dimensions = getBenchmarkDimensions();

  return (
    <BenchmarkingClient
      benchmarkTopics={benchmarkTopics}
      missedTopics={missedTopics}
      weeklyReport={weeklyReport}
      dimensions={dimensions}
      missedTypeDistribution={missedTypeDistribution}
      platforms={platforms}
      recentContent={recentContent}
      alerts={alerts}
      alertStats={alertStats}
      unreadAlertCount={unreadAlertCount}
      coverageOverview={coverageOverview}
      multiPlatformComparison={multiPlatformComparison}
      topicCandidates={topicCandidates}
    />
  );
}
