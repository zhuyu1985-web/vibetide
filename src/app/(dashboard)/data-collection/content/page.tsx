import { redirect } from "next/navigation";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { collectedItems } from "@/db/schema";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  listCollectedItems,
  listCollectedItemFilterOptions,
  type ContentFilters,
} from "@/lib/dal/collected-items";
import { listAdapterMetas } from "@/lib/collection/adapter-meta";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { simpleChannelBucket } from "@/lib/collection/channel-bucket";
import { ContentClient, type CollectedItemViewModel } from "./content-client";

// 强制动态渲染:URL filter 变化必须重新拉数据(否则可能命中 RSC cache)
export const dynamic = "force-dynamic";

type TimeWindow = "24h" | "7d" | "30d" | "all" | "custom";

function sinceFromTimeWindow(tw: TimeWindow): number | undefined {
  const now = Date.now();
  switch (tw) {
    case "24h":
      return now - 24 * 60 * 60 * 1000;
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "all":
    case "custom":
      return undefined;
  }
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function ContentPage({ searchParams }: PageProps) {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const params = await searchParams;

  const rawTime = params.time ?? "all";
  const timeWindow: TimeWindow = ["24h", "7d", "30d", "all", "custom"].includes(rawTime)
    ? (rawTime as TimeWindow)
    : "all";

  const rawView = params.view ?? "table";
  const initialView: "card" | "table" = rawView === "card" ? "card" : "table";

  const rawEnrichment = params.enrichment;
  const enrichmentStatus =
    rawEnrichment === "pending" || rawEnrichment === "enriched" || rawEnrichment === "failed"
      ? (rawEnrichment as ContentFilters["enrichmentStatus"])
      : undefined;

  const rawOutletTier = params.outletTier;
  const rawOutletRegion = params.outletRegion;

  // 解析发布时间范围 URL 参数(ISO date YYYY-MM-DD)
  const parseDateMs = (s: string | undefined, endOfDay: boolean): number | undefined => {
    if (!s) return undefined;
    const d = new Date(s);
    if (isNaN(d.getTime())) return undefined;
    if (endOfDay) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  // 发布时间筛选:三种来源,统一作用在 published_at 列。
  // 1) timeWindow 快捷选项(24h/7d/30d/all/custom);custom 不写 sinceMs,只走 publishedSince/Until
  // 2) custom 自定义范围 URL param publishedSince/publishedUntil(YYYY-MM-DD)
  // 3) 旧 firstSeenAt 时间窗废弃 - 没人再用 sinceMs/untilMs(作用在采集时间的窗)
  const timeWindowMs = timeWindow === "custom" ? undefined : sinceFromTimeWindow(timeWindow);
  const publishedSinceMs =
    timeWindow === "custom" ? parseDateMs(params.publishedSince, false) : timeWindowMs;
  const publishedUntilMs =
    timeWindow === "custom" ? parseDateMs(params.publishedUntil, true) : undefined;

  const filters: ContentFilters = {
    sourceType: params.sourceType || undefined,
    targetModule: params.module || undefined,
    // 时间筛选统一在 publishedAt;firstSeenAt 那一档不再使用
    publishedSinceMs,
    publishedUntilMs,
    searchText: params.q || undefined,
    enrichmentStatus,
    platformAlias: params.platform || undefined,
    outletTier: rawOutletTier || undefined,
    outletRegion: rawOutletRegion || undefined,
    // A2 (2026-05-14)
    outletId: params.outletId || undefined,
    category: params.category || undefined,
    tag: params.tag || undefined,
    // 舆情:媒体账号合并(2026-05-18) — 同时匹配 author/platform
    author: params.author || undefined,
  };

  const [{ items: rawItems, total }, baseAdapterMetas, outlets, filterOptions, channelRows] =
    await Promise.all([
      listCollectedItems(orgId, filters, { limit: 50, offset: 0 }),
      Promise.resolve(listAdapterMetas()),
      listOutletsByOrg(orgId),
      listCollectedItemFilterOptions(orgId),
      // 信息来源 chip 计数:按 firstSeenChannel GROUP BY 一次,前端按 bucket 折叠累加。
      // 这是 org 全量计数(不跟其他 filter 联动)— 类似图 1 的固定 chip 行,作"概览"使用。
      db
        .select({ ch: collectedItems.firstSeenChannel, n: sql<number>`count(*)::int` })
        .from(collectedItems)
        .where(eq(collectedItems.organizationId, orgId))
        .groupBy(collectedItems.firstSeenChannel),
    ]);

  // 把原始 firstSeenChannel 计数按 ChannelBucket 折叠(微博/抖音/微信/...);未归类的丢弃。
  const channelCounts: Record<string, number> = {};
  for (const { ch, n } of channelRows) {
    const bucket = simpleChannelBucket(ch);
    if (!bucket) continue;
    channelCounts[bucket] = (channelCounts[bucket] ?? 0) + n;
  }

  // 采集池筛选下拉追加 virtual "Excel 导入" 选项 — 它不是真 adapter,
  // 不在 /源管理 的"新建源"里出现,只为筛选 firstSeenSourceType=excel_import 服务。
  const adapterMetas = [
    ...baseAdapterMetas,
    {
      type: "excel_import",
      displayName: "Excel 导入",
      description: "通过界面或脚本批量导入的 Excel 数据",
      category: "url" as const,
      configFields: [],
    },
  ];

  const items: CollectedItemViewModel[] = rawItems.map((i) => ({
    id: i.id,
    title: i.title,
    summary: i.summary,
    firstSeenChannel: i.firstSeenChannel,
    firstSeenAt: i.firstSeenAt.toISOString(),
    publishedAt: i.publishedAt?.toISOString() ?? null,
    category: i.category,
    tags: i.tags,
    derivedModules: i.derivedModules,
    enrichmentStatus: i.enrichmentStatus,
    sourceChannels: (i.sourceChannels ?? []) as CollectedItemViewModel["sourceChannels"],
    outletName: i.outletName ?? null,
    outletTier: i.outletTier ?? null,
    sourceType: i.sourceType ?? null,
    author: i.author ?? null,
    platform: i.platform ?? null,
    accountId: i.accountId ?? null,
  }));

  return (
    <ContentClient
      items={items}
      total={total}
      adapterMetas={adapterMetas}
      outlets={outlets}
      filterOptions={filterOptions}
      channelCounts={channelCounts}
      initialFilters={{
        sourceType: params.sourceType,
        module: params.module,
        time: timeWindow,
        q: params.q,
        enrichment: rawEnrichment as "pending" | "enriched" | "failed" | undefined,
        platform: params.platform,
        outletTier: rawOutletTier,
        outletRegion: rawOutletRegion,
        // A2
        outletId: params.outletId,
        category: params.category,
        tag: params.tag,
        // 舆情筛选(2026-05-18)
        author: params.author,
        publishedSince: params.publishedSince,
        publishedUntil: params.publishedUntil,
      }}
      initialView={initialView}
    />
  );
}
