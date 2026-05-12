"use server";

import { requireAuth } from "@/lib/auth";
import {
  getCollectedItemDetail,
  getDerivedRecordsForItem,
  listCollectedItems,
  type ContentFilters,
  type DerivedRecordSummary,
} from "@/lib/dal/collected-items";
import { getOutletById } from "@/lib/dal/media-outlet-dictionary";
import type { CollectedItemViewModel } from "@/app/(dashboard)/data-collection/content/content-client";

async function requireOrg(): Promise<string> {
  const user = await requireAuth();
  if (!user.organizationId) throw new Error("无法获取组织信息");
  return user.organizationId;
}

// ────────────────────────────────────────────────
// 采集池分页加载（无限滚动）
// ────────────────────────────────────────────────

/** 与 ContentFilters 同 shape,但只暴露 client 真正会传的字段,且全部 JSON 可序列化 */
export interface LoadCollectedItemsFilters {
  sourceType?: string;
  targetModule?: string;
  sinceMs?: number;
  searchText?: string;
  enrichmentStatus?: "pending" | "enriched" | "failed";
  platformAlias?: string;
  outletTier?: string;
  outletRegion?: string;
}

export interface LoadCollectedItemsResult {
  items: CollectedItemViewModel[];
  total: number;
}

export async function loadCollectedItemsAction(
  filters: LoadCollectedItemsFilters,
  offset: number,
  limit = 50,
): Promise<LoadCollectedItemsResult> {
  const orgId = await requireOrg();
  const { items: rawItems, total } = await listCollectedItems(
    orgId,
    filters as ContentFilters,
    { limit, offset },
  );
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
  }));
  return { items, total };
}

export interface ItemDetailPayload {
  id: string;
  title: string;
  content: string | null;
  summary: string | null;
  canonicalUrl: string | null;
  publishedAt: string | null;
  firstSeenChannel: string;
  firstSeenAt: string;
  category: string | null;
  tags: string[] | null;
  language: string | null;
  derivedModules: string[];
  rawMetadata: unknown;
  enrichmentStatus: string;
  // Outlet fields (Task 6.1)
  outletId: string | null;
  outletName: string | null;
  outletTier: string | null;
  outletRegion: string | null;
  sourceChannels: Array<{
    channel: string;
    url?: string;
    sourceId: string;
    runId: string;
    capturedAt: string;
  }>;
  derivedRecords: DerivedRecordSummary[];
}

export async function getCollectionItemDetailAction(
  itemId: string,
): Promise<ItemDetailPayload | null> {
  const orgId = await requireOrg();
  const item = await getCollectedItemDetail(itemId, orgId);
  if (!item) return null;
  const derived = await getDerivedRecordsForItem(itemId, orgId);

  const sourceChannels = Array.isArray(item.sourceChannels)
    ? (item.sourceChannels as ItemDetailPayload["sourceChannels"])
    : [];

  // Look up outlet name if outletId is set
  let outletName: string | null = null;
  if (item.outletId) {
    const outlet = await getOutletById(item.outletId, orgId);
    outletName = outlet?.outletName ?? null;
  }

  return {
    id: item.id,
    title: item.title,
    content: item.content,
    summary: item.summary,
    canonicalUrl: item.canonicalUrl,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    firstSeenChannel: item.firstSeenChannel,
    firstSeenAt: item.firstSeenAt.toISOString(),
    category: item.category,
    tags: item.tags,
    language: item.language,
    derivedModules: item.derivedModules,
    rawMetadata: item.rawMetadata,
    enrichmentStatus: item.enrichmentStatus,
    outletId: item.outletId ?? null,
    outletName,
    outletTier: item.outletTier ?? null,
    outletRegion: item.outletRegion ?? null,
    sourceChannels,
    derivedRecords: derived,
  };
}
