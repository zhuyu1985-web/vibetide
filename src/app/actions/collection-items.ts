"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import {
  bulkDeleteCollectedItemsByIds,
  exportCollectedItemsForExcel,
  getCollectedItemDetail,
  getDerivedRecordsForItem,
  listCollectedItems,
  type ContentFilters,
  type DerivedRecordSummary,
} from "@/lib/dal/collected-items";
import { getOutletById } from "@/lib/dal/media-outlet-dictionary";
import type { CollectedItemViewModel } from "@/app/(dashboard)/data-collection/content/content-client";
import {
  exportRowToOpinionRecord,
  EXPORT_COLUMN_ORDER,
} from "@/lib/collection/bulk-export/opinion-export";

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
  publishedSinceMs?: number;
  publishedUntilMs?: number;
  searchText?: string;
  enrichmentStatus?: "pending" | "enriched" | "failed";
  platformAlias?: string;
  outletTier?: string;
  outletRegion?: string;
  // A2 (2026-05-14)
  outletId?: string;
  category?: string;
  tag?: string;
  // 舆情/账号维度(2026-05-17)
  platform?: string;
  author?: string;
  accountId?: string;
  sentiment?: string;
  infoType?: string;
  ipRegion?: string;
  postRegion?: string;
  mentionedRegion?: string;
  matchedKeyword?: string;
  matchedRegion?: string;
  industry?: string;
  minLikeCount?: number;
  minCommentCount?: number;
  minViewCount?: number;
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
    author: i.author ?? null,
    platform: i.platform ?? null,
    accountId: i.accountId ?? null,
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
  category: string[];
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
  // ── 舆情/账号维度(2026-05-17) ──
  externalId: string | null;
  platform: string | null;
  author: string | null;
  accountId: string | null;
  accountHandle: string | null;
  authorFollowerCount: number | null;
  sentiment: string | null;
  infoType: string | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  favoriteCount: number;
  replyCount: number;
  ipRegion: string | null;
  postRegion: string | null;
  mentionedRegions: string[] | null;
  matchedKeywords: string[] | null;
  matchedRegions: string[] | null;
  industries: string[] | null;
  coverImageUrl: string | null;
  durationSeconds: number | null;
  ocrText: string | null;
  asrText: string | null;
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
    // 舆情/账号维度
    externalId: item.externalId,
    platform: item.platform,
    author: item.author,
    accountId: item.accountId,
    accountHandle: item.accountHandle,
    authorFollowerCount: item.authorFollowerCount,
    sentiment: item.sentiment,
    infoType: item.infoType,
    likeCount: item.likeCount,
    commentCount: item.commentCount,
    shareCount: item.shareCount,
    viewCount: item.viewCount,
    favoriteCount: item.favoriteCount,
    replyCount: item.replyCount,
    ipRegion: item.ipRegion,
    postRegion: item.postRegion,
    mentionedRegions: item.mentionedRegions,
    matchedKeywords: item.matchedKeywords,
    matchedRegions: item.matchedRegions,
    industries: item.industries,
    coverImageUrl: item.coverImageUrl,
    durationSeconds: item.durationSeconds,
    ocrText: item.ocrText,
    asrText: item.asrText,
  };
}

// ────────────────────────────────────────────────
// 批量删除
// ────────────────────────────────────────────────

// ────────────────────────────────────────────────
// 导出 Excel(舆情 33 列格式,跟 data.xlsx 模板对齐)
// ────────────────────────────────────────────────

export interface ExportExcelResult {
  /** base64 编码的 .xlsx 文件内容 */
  base64: string;
  /** 行数(不含 header) */
  rowCount: number;
  /** 推荐文件名 */
  fileName: string;
}

export async function exportCollectedItemsToExcelAction(
  filters: LoadCollectedItemsFilters,
): Promise<ExportExcelResult> {
  const orgId = await requireOrg();
  const rows = await exportCollectedItemsForExcel(orgId, filters as ContentFilters);

  // 转 33 列 records
  const records = rows.map((row, i) =>
    exportRowToOpinionRecord(row, i + 1),
  );

  // 生成 xlsx buffer
  const XLSX = await import("@e965/xlsx");
  const sheet = XLSX.utils.json_to_sheet(records, {
    header: [...EXPORT_COLUMN_ORDER],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "舆情数据");
  const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  // 文件名: vibetide_export_YYYYMMDD_HHmm.xlsx
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fileName =
    `vibetide_export_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;

  return {
    base64: buffer.toString("base64"),
    rowCount: rows.length,
    fileName,
  };
}

// ────────────────────────────────────────────────
// 批量删除
// ────────────────────────────────────────────────

const MAX_BULK_DELETE = 500;

export async function bulkDeleteCollectedItemsAction(
  ids: string[],
): Promise<{ deletedCount: number }> {
  const orgId = await requireOrg();
  if (!Array.isArray(ids) || ids.length === 0) {
    return { deletedCount: 0 };
  }
  if (ids.length > MAX_BULK_DELETE) {
    throw new Error(`一次最多删除 ${MAX_BULK_DELETE} 条`);
  }
  const result = await bulkDeleteCollectedItemsByIds(orgId, ids);
  revalidatePath("/data-collection/content");
  return result;
}
