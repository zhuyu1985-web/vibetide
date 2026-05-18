"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { collectedItems, collectionRuns, collectionSources } from "@/db/schema/collection";
import { requireAuth } from "@/lib/auth";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { recognizeOutlet } from "@/lib/collection/outlet-recognizer";
import {
  transformRowToRawItem,
  type ImportMapping,
  type ImportDefaults,
} from "@/lib/collection/bulk-import/transform";
import {
  transformOpinionRow,
  isOpinionExcelFormat,
} from "@/lib/collection/bulk-import/opinion-transform";
import { writeItems } from "@/lib/collection/writer";
import {
  seedExcelImportVirtualSource,
  EXCEL_IMPORT_SOURCE_NAME,
} from "@/db/seed/excel-import-virtual-source";
import type { RawItem } from "@/lib/collection/types";

// ─────────────────────────────────────────────────────────────────────────────
// Task 2.1 — previewBulkImport
// 扫前 100 行：outlet 字典命中预测 + fingerprint 去重检查 + 错误样本
// ─────────────────────────────────────────────────────────────────────────────

export interface PreviewPayload {
  sampleRows: Record<string, unknown>[]; // 前 100 行（client 传入）
  mapping: ImportMapping;
  defaults: ImportDefaults;
}

export interface PreviewResult {
  totalScanned: number;
  hitDictCount: number;
  skippedDuplicateCount: number;
  errorRows: Array<{ rowIndex: number; reason: string; row: Record<string, unknown> }>;
}

export async function previewBulkImport(payload: PreviewPayload): Promise<PreviewResult> {
  const user = await requireAuth();
  const orgId = user.organizationId;

  const sampleRows = payload.sampleRows.slice(0, 100);
  const dict = await listOutletsByOrg(orgId, { includeInactive: false });

  let hitDictCount = 0;
  let skippedDuplicateCount = 0;
  const errorRows: PreviewResult["errorRows"] = [];

  // 第一轮：transform，收集合法行 + fingerprint
  const validRows: Array<{ index: number; rawItem: RawItem; fingerprint: string }> = [];
  const fingerprints: string[] = [];

  for (let i = 0; i < sampleRows.length; i++) {
    const row = sampleRows[i]!;
    try {
      const transformed = transformRowToRawItem(row, payload.mapping, payload.defaults);
      if (!transformed) {
        errorRows.push({ rowIndex: i, reason: "title 必填字段为空", row });
        continue;
      }
      validRows.push({
        index: i,
        rawItem: transformed.rawItem,
        fingerprint: transformed.fingerprint,
      });
      fingerprints.push(transformed.fingerprint);
    } catch (err) {
      errorRows.push({ rowIndex: i, reason: (err as Error).message, row });
    }
  }

  // 批量查 fingerprint 是否已存在（一次 inArray 查询）
  const existingFps = new Set<string>();
  if (fingerprints.length > 0) {
    const existingItems = await db
      .select({ fp: collectedItems.contentFingerprint })
      .from(collectedItems)
      .where(
        and(
          eq(collectedItems.organizationId, orgId),
          inArray(collectedItems.contentFingerprint, fingerprints),
        ),
      );
    for (const row of existingItems) {
      existingFps.add(row.fp);
    }
  }

  // 第二轮：对合法行统计命中/重复
  for (const { rawItem, fingerprint } of validRows) {
    if (existingFps.has(fingerprint)) {
      skippedDuplicateCount++;
    } else {
      const recognized = recognizeOutlet(
        {
          canonicalUrl: rawItem.url ?? null,
          rawMetadata: rawItem.rawMetadata ?? null,
        },
        {
          outletId: null,
          defaultOutletTier: payload.defaults.outletTier,
          defaultOutletRegion: payload.defaults.outletRegion,
        },
        dict,
      );
      if (recognized?.outletId) hitDictCount++;
    }
  }

  return {
    totalScanned: sampleRows.length,
    hitDictCount,
    skippedDuplicateCount,
    errorRows: errorRows.slice(0, 10), // 最多 10 条错误样本
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 2.2 — executeBulkImport
// 分批 500 行 + 创建/复用 collection_run + 调 writeItems + 累计统计
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutePayload {
  rows: Record<string, unknown>[]; // 当前批次（最多 500 行）
  mapping: ImportMapping;
  defaults: ImportDefaults;
  batchIndex: number;
  totalBatches: number;
  runId?: string; // 第二批起复用第一批的 runId
}

export interface ExecuteResult {
  batchInserted: number;
  batchSkipped: number;
  batchFailed: number;
  errorRows: Array<{ rowIndex: number; reason: string; row: Record<string, unknown> }>;
  runId: string; // 返回供后续批次复用
}

export async function executeBulkImport(payload: ExecutePayload): Promise<ExecuteResult> {
  const user = await requireAuth();
  const orgId = user.organizationId;

  // 1. 确保 virtual source 存在
  await seedExcelImportVirtualSource(orgId);
  const [virtualSource] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, orgId),
        eq(collectionSources.name, EXCEL_IMPORT_SOURCE_NAME),
      ),
    )
    .limit(1);
  if (!virtualSource) throw new Error("virtual excel_import source 创建失败");

  // 2. 第一批时创建 collection_run；后续批次复用传入的 runId
  let runId = payload.runId;
  if (!runId) {
    const [newRun] = await db
      .insert(collectionRuns)
      .values({
        sourceId: virtualSource.id,
        organizationId: orgId,
        trigger: "manual",
        startedAt: new Date(),
        status: "running",
        itemsAttempted: 0,
        itemsInserted: 0,
        itemsMerged: 0,
        itemsFailed: 0,
        metadata: {
          source: "bulk_import",
          totalBatches: payload.totalBatches,
        },
      })
      .returning();
    runId = newRun!.id;
  }

  // 3. 转 RawItem（丢弃 fingerprint — writer 自己算）
  const rawItems: RawItem[] = [];
  const errorRows: ExecuteResult["errorRows"] = [];

  for (let i = 0; i < payload.rows.length; i++) {
    const row = payload.rows[i]!;
    const absoluteIndex = payload.batchIndex * 500 + i;
    try {
      const transformed = transformRowToRawItem(row, payload.mapping, payload.defaults);
      if (!transformed) {
        errorRows.push({ rowIndex: absoluteIndex, reason: "title 必填字段为空", row });
      } else {
        rawItems.push(transformed.rawItem);
      }
    } catch (err) {
      errorRows.push({
        rowIndex: absoluteIndex,
        reason: (err as Error).message,
        row,
      });
    }
  }

  // 4. 调 writeItems
  let batchInserted = 0;
  let batchSkipped = 0;
  let batchFailed = 0;

  if (rawItems.length > 0) {
    try {
      const result = await writeItems({
        runId,
        sourceId: virtualSource.id,
        organizationId: orgId,
        source: {
          targetModules: virtualSource.targetModules,
          defaultCategory: virtualSource.defaultCategory,
          defaultTags: virtualSource.defaultTags,
          outletId: virtualSource.outletId,
          defaultOutletTier: virtualSource.defaultOutletTier,
          defaultOutletRegion: virtualSource.defaultOutletRegion,
        },
        items: rawItems,
        // Excel 导入路径统一按 URL 去重(同标题不同来源应视为独立条目)
        dedupStrategy: "url_only",
      });
      // WriteResult 字段：inserted / merged / failed（不是 itemsInserted 等）
      batchInserted = result.inserted;
      batchSkipped = result.merged;
      batchFailed = result.failed;
    } catch (err) {
      batchFailed += rawItems.length;
      errorRows.push({
        rowIndex: -1,
        reason: `批量写入失败：${(err as Error).message}`,
        row: { batchIndex: payload.batchIndex },
      });
    }
  }

  // 5. 最后一批 → 标记 run 完成
  if (payload.batchIndex === payload.totalBatches - 1) {
    await db
      .update(collectionRuns)
      .set({
        finishedAt: new Date(),
        status: errorRows.length > 0 ? "partial" : "success",
      })
      .where(eq(collectionRuns.id, runId));
  }

  return {
    batchInserted,
    batchSkipped,
    batchFailed,
    errorRows: errorRows.slice(0, 50),
    runId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 舆情格式批量导入 — 列名硬编码,不需要 mapping
// 跟 executeBulkImport 是平行路径(走不同 transformer)
// ─────────────────────────────────────────────────────────────────────────────

export interface OpinionImportPayload {
  rows: Record<string, unknown>[]; // 当前批次(最多 500 行)
  batchIndex: number;
  totalBatches: number;
  runId?: string; // 第二批起复用第一批的 runId
}

export interface OpinionImportResult {
  batchInserted: number;
  batchSkipped: number;
  batchFailed: number;
  errorRows: Array<{ rowIndex: number; reason: string }>;
  runId: string;
}

/** 判断 columns 是否舆情格式 — 给 UI 用,决定走哪条 import 路径 */
export async function detectOpinionFormat(columns: string[]): Promise<boolean> {
  return isOpinionExcelFormat(columns);
}

export async function importOpinionBatch(
  payload: OpinionImportPayload,
): Promise<OpinionImportResult> {
  const user = await requireAuth();
  const orgId = user.organizationId;

  // virtual source 复用 excel_import 那条
  await seedExcelImportVirtualSource(orgId);
  const [virtualSource] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, orgId),
        eq(collectionSources.name, EXCEL_IMPORT_SOURCE_NAME),
      ),
    )
    .limit(1);
  if (!virtualSource) throw new Error("virtual excel_import source 创建失败");

  // 第一批创建 run,后续批次复用
  let runId = payload.runId;
  if (!runId) {
    const [newRun] = await db
      .insert(collectionRuns)
      .values({
        sourceId: virtualSource.id,
        organizationId: orgId,
        trigger: "manual",
        startedAt: new Date(),
        status: "running",
        itemsAttempted: 0,
        itemsInserted: 0,
        itemsMerged: 0,
        itemsFailed: 0,
        metadata: {
          source: "opinion_bulk_import",
          totalBatches: payload.totalBatches,
        },
      })
      .returning();
    runId = newRun!.id;
  }

  // transform
  const rawItems: RawItem[] = [];
  const errorRows: OpinionImportResult["errorRows"] = [];

  for (let i = 0; i < payload.rows.length; i++) {
    const row = payload.rows[i]!;
    const absoluteIndex = payload.batchIndex * 500 + i;
    try {
      const r = transformOpinionRow(row);
      if (!r) {
        errorRows.push({ rowIndex: absoluteIndex, reason: "标题为空,跳过" });
      } else {
        rawItems.push(r.rawItem);
      }
    } catch (err) {
      errorRows.push({ rowIndex: absoluteIndex, reason: (err as Error).message });
    }
  }

  let batchInserted = 0;
  let batchSkipped = 0;
  let batchFailed = 0;

  if (rawItems.length > 0) {
    try {
      const result = await writeItems({
        runId,
        sourceId: virtualSource.id,
        organizationId: orgId,
        source: {
          targetModules: virtualSource.targetModules,
          defaultCategory: virtualSource.defaultCategory,
          defaultTags: virtualSource.defaultTags,
          outletId: virtualSource.outletId,
          defaultOutletTier: virtualSource.defaultOutletTier,
          defaultOutletRegion: virtualSource.defaultOutletRegion,
        },
        items: rawItems,
        // 舆情数据:严格按 URL 去重;不同媒体转发同标题保留为独立条目
        dedupStrategy: "url_only",
      });
      batchInserted = result.inserted;
      batchSkipped = result.merged;
      batchFailed = result.failed;
    } catch (err) {
      batchFailed += rawItems.length;
      errorRows.push({
        rowIndex: -1,
        reason: `批量写入失败:${(err as Error).message}`,
      });
    }
  }

  // 最后一批 → 标记 run 完成
  if (payload.batchIndex === payload.totalBatches - 1) {
    await db
      .update(collectionRuns)
      .set({
        finishedAt: new Date(),
        status: errorRows.length > 0 ? "partial" : "success",
      })
      .where(eq(collectionRuns.id, runId));
  }

  return {
    batchInserted,
    batchSkipped,
    batchFailed,
    errorRows: errorRows.slice(0, 50),
    runId,
  };
}
