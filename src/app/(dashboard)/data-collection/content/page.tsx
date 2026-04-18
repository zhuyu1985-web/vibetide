import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import {
  listCollectedItems,
  type ContentFilters,
} from "@/lib/dal/collected-items";
import { listAdapterMetas } from "@/lib/collection/adapter-meta";
import { ContentClient, type CollectedItemViewModel } from "./content-client";

export const dynamic = "force-dynamic";

type TimeWindow = "24h" | "7d" | "30d" | "all";

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

  const rawTime = params.time ?? "7d";
  const timeWindow: TimeWindow = ["24h", "7d", "30d", "all"].includes(rawTime)
    ? (rawTime as TimeWindow)
    : "7d";

  const rawView = params.view ?? "card";
  const initialView: "card" | "table" = rawView === "table" ? "table" : "card";

  const rawEnrichment = params.enrichment;
  const enrichmentStatus =
    rawEnrichment === "pending" || rawEnrichment === "enriched" || rawEnrichment === "failed"
      ? (rawEnrichment as ContentFilters["enrichmentStatus"])
      : undefined;

  const filters: ContentFilters = {
    sourceType: params.sourceType || undefined,
    targetModule: params.module || undefined,
    sinceMs: sinceFromTimeWindow(timeWindow),
    searchText: params.q || undefined,
    enrichmentStatus,
    platformAlias: params.platform || undefined,
  };

  const [{ items: rawItems, total }, adapterMetas] = await Promise.all([
    listCollectedItems(orgId, filters, { limit: 50, offset: 0 }),
    Promise.resolve(listAdapterMetas()),
  ]);

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
  }));

  return (
    <ContentClient
      items={items}
      total={total}
      adapterMetas={adapterMetas}
      initialFilters={{
        sourceType: params.sourceType,
        module: params.module,
        time: timeWindow,
        q: params.q,
        enrichment: rawEnrichment as "pending" | "enriched" | "failed" | undefined,
        platform: params.platform,
      }}
      initialView={initialView}
    />
  );
}
