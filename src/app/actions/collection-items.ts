"use server";

import { requireAuth } from "@/lib/auth";
import {
  getCollectedItemDetail,
  getDerivedRecordsForItem,
  type DerivedRecordSummary,
} from "@/lib/dal/collected-items";
import { getOutletById } from "@/lib/dal/media-outlet-dictionary";

async function requireOrg(): Promise<string> {
  const user = await requireAuth();
  if (!user.organizationId) throw new Error("无法获取组织信息");
  return user.organizationId;
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
