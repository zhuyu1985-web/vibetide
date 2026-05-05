import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getMonitoringSummary,
  getCollectionTrend,
  getSourceErrorList,
  getRecentErrors,
} from "@/lib/dal/collected-items";
import { listCollectionSources } from "@/lib/dal/collection";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { MonitoringClient } from "./monitoring-client";

export default async function MonitoringPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [summary, trend, errorSources, recentErrors, sources, tikhubCostRaw] =
    await Promise.all([
      getMonitoringSummary(orgId),
      getCollectionTrend(orgId, 7),
      getSourceErrorList(orgId, 7, 10),
      getRecentErrors(orgId, 30),
      listCollectionSources(orgId),
      db.execute(sql`
        SELECT
          COALESCE(SUM((cr.metadata->>'tikhubCostUsd')::numeric), 0) AS total_cost_usd,
          COUNT(cr.id) AS run_count
        FROM collection_runs cr
        JOIN collection_sources cs ON cr.source_id = cs.id
        WHERE cs.organization_id = ${orgId}
          AND cs.source_type = 'tikhub'
          AND cr.started_at >= date_trunc('month', now())
      `),
    ]);

  // db.execute with postgres driver returns rows as the result array directly
  const tikhubRows = tikhubCostRaw as unknown as Array<{ total_cost_usd: string; run_count: string }>;
  const tikhubCostRow = tikhubRows[0];
  const tikhubCost = {
    totalCostUsd: parseFloat(tikhubCostRow?.total_cost_usd ?? "0"),
    runCount: parseInt(tikhubCostRow?.run_count ?? "0", 10),
  };

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
      tikhubCost={tikhubCost}
    />
  );
}
