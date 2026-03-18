export const dynamic = "force-dynamic";

import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getBenchmarkTopics,
  getMissedTopics,
  getWeeklyReport,
  getMissedTypeDistribution,
  getBenchmarkDimensions,
} from "@/lib/dal/benchmarking";
import { BenchmarkingClient } from "./benchmarking-client";

export default async function BenchmarkingPage() {
  let benchmarkTopics: Awaited<ReturnType<typeof getBenchmarkTopics>> = [];
  let missedTopics: Awaited<ReturnType<typeof getMissedTopics>> = [];
  let weeklyReport: Awaited<ReturnType<typeof getWeeklyReport>> | null = null;
  let missedTypeDistribution: Awaited<ReturnType<typeof getMissedTypeDistribution>> = [];

  try {
    const orgId = await getCurrentUserOrg();
    if (orgId) {
      [benchmarkTopics, missedTopics, weeklyReport, missedTypeDistribution] =
        await Promise.all([
          getBenchmarkTopics(orgId),
          getMissedTopics(orgId),
          getWeeklyReport(orgId),
          getMissedTypeDistribution(orgId),
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
    />
  );
}
