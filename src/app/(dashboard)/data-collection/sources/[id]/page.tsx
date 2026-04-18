import { notFound, redirect } from "next/navigation";
import {
  getCollectionSourceById,
  listRecentRunsBySource,
  listRecentItemsBySource,
} from "@/lib/dal/collection";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getAdapterMeta } from "@/lib/collection/adapter-meta";
import { SourceDetailClient } from "./source-detail-client";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const source = await getCollectionSourceById(id, orgId);
  if (!source) notFound();

  const [runs, items] = await Promise.all([
    listRecentRunsBySource(id, orgId, 20),
    listRecentItemsBySource(id, orgId, 20),
  ]);
  const meta = getAdapterMeta(source.sourceType);

  return (
    <SourceDetailClient
      source={{
        id: source.id,
        name: source.name,
        sourceType: source.sourceType,
        sourceTypeLabel: meta?.displayName ?? source.sourceType,
        config: source.config,
        scheduleCron: source.scheduleCron,
        targetModules: source.targetModules,
        defaultCategory: source.defaultCategory,
        defaultTags: source.defaultTags,
        enabled: source.enabled,
        createdAt: source.createdAt.toISOString(),
        lastRunAt: source.lastRunAt?.toISOString() ?? null,
        lastRunStatus: source.lastRunStatus,
        totalItemsCollected: source.totalItemsCollected,
        totalRuns: source.totalRuns,
      }}
      runs={runs.map((r) => ({
        id: r.id,
        trigger: r.trigger,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt?.toISOString() ?? null,
        status: r.status,
        itemsAttempted: r.itemsAttempted,
        itemsInserted: r.itemsInserted,
        itemsMerged: r.itemsMerged,
        itemsFailed: r.itemsFailed,
        errorSummary: r.errorSummary,
      }))}
      items={items.map((i) => ({
        id: i.id,
        title: i.title,
        canonicalUrl: i.canonicalUrl,
        firstSeenChannel: i.firstSeenChannel,
        firstSeenAt: i.firstSeenAt.toISOString(),
        category: i.category,
        tags: i.tags,
      }))}
    />
  );
}
