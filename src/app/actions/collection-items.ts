"use server";

import { requireAuth } from "@/lib/auth";
import {
  getCollectedItemDetail,
  getDerivedRecordsForItem,
  type DerivedRecordSummary,
} from "@/lib/dal/collected-items";

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
    sourceChannels,
    derivedRecords: derived,
  };
}
