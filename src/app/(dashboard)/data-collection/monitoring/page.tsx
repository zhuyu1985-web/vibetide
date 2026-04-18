import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getMonitoringSummary,
  getCollectionTrend,
  getSourceErrorList,
  getRecentErrors,
} from "@/lib/dal/collected-items";
import { listCollectionSources } from "@/lib/dal/collection";
import { MonitoringClient } from "./monitoring-client";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [summary, trend, errorSources, recentErrors, sources] =
    await Promise.all([
      getMonitoringSummary(orgId),
      getCollectionTrend(orgId, 7),
      getSourceErrorList(orgId, 7, 10),
      getRecentErrors(orgId, 30),
      listCollectionSources(orgId),
    ]);

  // Compute source type distribution from the sources list
  const sourceDistribution: { type: string; count: number }[] = [];
  const typeMap = new Map<string, number>();
  for (const s of sources) {
    typeMap.set(s.sourceType, (typeMap.get(s.sourceType) ?? 0) + 1);
  }
  for (const [type, count] of typeMap.entries()) {
    sourceDistribution.push({ type, count });
  }

  // Serialize Dates to ISO strings for client component
  const serializedErrorSources = errorSources.map((e) => ({
    ...e,
    lastFailedAt: e.lastFailedAt?.toISOString() ?? null,
  }));

  const serializedRecentErrors = recentErrors.map((e) => ({
    ...e,
    loggedAt: e.loggedAt.toISOString(),
  }));

  return (
    <MonitoringClient
      summary={summary}
      trend={trend}
      errorSources={serializedErrorSources}
      recentErrors={serializedRecentErrors}
      sourceDistribution={sourceDistribution}
    />
  );
}
