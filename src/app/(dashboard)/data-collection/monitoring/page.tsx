import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  getMonitoringSummary,
  getCollectionTrend,
  getSourceErrorList,
  getRecentErrors,
} from "@/lib/dal/collected-items";
import { listCollectionSources } from "@/lib/dal/collection";
import {
  getBusinessSummary,
  getChannelTrend,
  getRecentBusinessItems,
} from "@/lib/dal/monitoring-business";
import { listResearchTopics } from "@/lib/dal/research/research-topics";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { PageHeader } from "@/components/shared/page-header";
import { MonitoringClient } from "./monitoring-client";
import type {
  BusinessChannelOption,
  BusinessTimeWindow,
} from "./business-dashboard";

export const dynamic = "force-dynamic";

interface MonitoringPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function timeWindowToSince(window: BusinessTimeWindow): Date | undefined {
  if (window === "all") return undefined;
  const hours = window === "24h" ? 24 : window === "30d" ? 30 * 24 : 7 * 24;
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function parseTimeWindow(raw: string | string[] | undefined): BusinessTimeWindow {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "24h" || v === "7d" || v === "30d" || v === "all") return v;
  return "7d";
}

function pickStr(raw: string | string[] | undefined): string | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || v === "all") return undefined;
  return v;
}

export default async function MonitoringPage({ searchParams }: MonitoringPageProps) {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const sp = (await searchParams) ?? {};
  const timeWindow = parseTimeWindow(sp.window);
  const topicId = pickStr(sp.topicId);
  const channel = pickStr(sp.channel);
  const initialTab = ((): "business" | "ops" => {
    const v = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
    return v === "ops" ? "ops" : "business";
  })();

  const businessFilters = {
    since: timeWindowToSince(timeWindow),
    topicIds: topicId ? [topicId] : undefined,
    channels: channel ? [channel] : undefined,
  };

  const [
    summary,
    trend,
    errorSources,
    recentErrors,
    sources,
    tikhubCostRaw,
    businessSummary,
    channelTrend,
    recentBusinessItems,
    topics,
    channelOptionsRaw,
  ] = await Promise.all([
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
    getBusinessSummary(orgId, businessFilters),
    getChannelTrend(orgId, businessFilters, "day"),
    getRecentBusinessItems(orgId, businessFilters, 20),
    listResearchTopics(orgId),
    // 拉本 org 下出现过的 first_seen_channel(给筛选下拉);限制 50 条避免爆炸
    db.execute<{ channel: string }>(sql`
        SELECT first_seen_channel AS channel
        FROM collected_items
        WHERE organization_id = ${orgId}::uuid
        GROUP BY first_seen_channel
        ORDER BY COUNT(*) DESC
        LIMIT 50
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

  const serializedRecentBusinessItems = recentBusinessItems.map((it) => ({
    ...it,
    firstSeenAt: it.firstSeenAt.toISOString(),
  }));

  const channelOptions: BusinessChannelOption[] = (channelOptionsRaw as unknown as Array<{ channel: string }>)
    .map((r) => ({ slug: r.channel, label: r.channel }));

  return (
    <>
      <PageHeader
        title="监控面板"
        description="查看采集运行、业务覆盖和异常情况，跟踪采集系统健康状态。"
      />
      <MonitoringClient
        initialTab={initialTab}
        operationsProps={{
          summary,
          trend,
          errorSources: serializedErrorSources,
          recentErrors: serializedRecentErrors,
          sourceDistribution,
          tikhubCost,
        }}
        businessProps={{
          summary: businessSummary,
          trend: channelTrend,
          recentItems: serializedRecentBusinessItems,
          topics: topics.map((t) => ({ id: t.id, name: t.name })),
          channelOptions,
          initialFilters: {
            topicId,
            channel,
            timeWindow,
          },
        }}
      />
    </>
  );
}
