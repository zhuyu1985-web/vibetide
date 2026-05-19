"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  researchTopics,
  researchTopicKeywords,
  researchTopicSamples,
} from "@/db/schema/research/research-topics";
import { eq, and } from "drizzle-orm";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { inngest } from "@/inngest/client";
import { getResearchTopicById } from "@/lib/dal/research/research-topics";
import { createReport as createResearchReport } from "@/lib/dal/research/reports";
import {
  searchCollectedItemsByTopicKeywords,
  type CollectedItemWithAnnotations,
} from "@/lib/dal/research/collected-item-search";
import type { ContentFilters } from "@/lib/dal/collected-items";
import type { ReportSearchSnapshot } from "@/db/schema/research/reports";
import type {
  AdvancedSearchCondition,
  SidebarFilter,
} from "@/app/(dashboard)/research/search-mode-types";

// ---------- Schemas ----------

const createTopicSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateTopicSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const addKeywordSchema = z.object({
  topicId: z.string().uuid(),
  keyword: z.string().min(1).max(100),
  isPrimary: z.boolean().optional(),
});

const updateKeywordSchema = z.object({
  id: z.string().uuid(),
  keyword: z.string().min(1).max(100).optional(),
  isPrimary: z.boolean().optional(),
});

const addSampleSchema = z.object({
  topicId: z.string().uuid(),
  sampleText: z.string().min(10).max(2000),
});

const updateSampleSchema = z.object({
  id: z.string().uuid(),
  sampleText: z.string().min(10).max(2000),
});

const MAX_TOPIC_REPORT_ITEMS = 500;
const MAX_TOPIC_EXPORT_ITEMS = 100000;

// ---------- Helpers ----------

type Result<T = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

type TopicDetail = NonNullable<Awaited<ReturnType<typeof getResearchTopicById>>>;

export interface TopicSearchActionFilters {
  channelLabels?: string[];
  platformAlias?: string;
  sourceType?: string;
  targetModule?: string;
  publishedAtFrom?: number; // epoch ms
  publishedAtTo?: number;
  titleKeyword?: string;
  searchText?: string;
  enrichmentStatus?: "pending" | "enriched" | "failed";
  outletTier?: string;
  outletRegion?: string;
  outletId?: string;
  category?: string;
  tag?: string;
  author?: string;
}

export interface TopicExportExcelResult {
  base64: string;
  rowCount: number;
  fileName: string;
}

function fail(e: unknown): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function buildTopicKeywords(detail: TopicDetail): string[] {
  return [
    detail.topic.name,
    ...detail.keywords.map((keyword) => keyword.keyword),
  ];
}

async function loadTopicSearchContext(
  topicId: string,
  organizationId: string,
): Promise<{ detail: TopicDetail; topicKeywords: string[] } | null> {
  const detail = await getResearchTopicById(topicId, organizationId);
  if (!detail) return null;
  return { detail, topicKeywords: buildTopicKeywords(detail) };
}

function mapTopicFiltersToContentFilters(
  filters: TopicSearchActionFilters,
): ContentFilters {
  return {
    sourceType: filters.sourceType,
    targetModule: filters.targetModule,
    publishedSinceMs: filters.publishedAtFrom,
    publishedUntilMs: filters.publishedAtTo,
    searchText: filters.searchText ?? filters.titleKeyword,
    enrichmentStatus: filters.enrichmentStatus,
    platformAlias: filters.platformAlias,
    outletTier: filters.outletTier,
    outletRegion: filters.outletRegion,
    outletId: filters.outletId,
    category: filters.category,
    tag: filters.tag,
    author: filters.author,
  };
}

function buildTopicReportConditions(
  filters: TopicSearchActionFilters,
): AdvancedSearchCondition[] {
  const conditions: AdvancedSearchCondition[] = [];
  const searchText = (filters.searchText ?? filters.titleKeyword)?.trim();
  if (searchText) {
    conditions.push({
      field: "content",
      operator: "contains",
      value: searchText,
      logic: "and",
    });
  }
  if (filters.author) {
    conditions.push({
      field: "author",
      operator: "contains",
      value: filters.author,
      logic: "and",
    });
  }
  if (filters.outletRegion) {
    conditions.push({
      field: "outletRegion",
      operator: "equals",
      value: filters.outletRegion,
      logic: "and",
    });
  }
  return conditions;
}

function buildTopicReportSidebarFilter(
  topicId: string,
  filters: TopicSearchActionFilters,
): SidebarFilter {
  const sidebarFilter: SidebarFilter = { topicIds: [topicId] };
  if (filters.outletTier) {
    sidebarFilter.outletTiers = [filters.outletTier];
  }
  if (filters.publishedAtFrom || filters.publishedAtTo) {
    sidebarFilter.publishedAtRange = {
      from: new Date(filters.publishedAtFrom ?? 0).toISOString(),
      to: new Date(filters.publishedAtTo ?? Date.now()).toISOString(),
    };
  }
  return sidebarFilter;
}

function buildTopicReportDescription(
  detail: TopicDetail,
  topicKeywords: string[],
  filters: TopicSearchActionFilters,
  total: number,
): string {
  const parts = [
    detail.topic.description?.trim(),
    `主题关键词: ${topicKeywords.slice(0, 50).join("、") || detail.topic.name}`,
    `当前筛选命中: ${total} 条`,
  ].filter(Boolean);

  const filterParts: string[] = [];
  if (filters.platformAlias) filterParts.push(`信息来源=${filters.platformAlias}`);
  if (filters.sourceType) filterParts.push(`源类型=${filters.sourceType}`);
  if (filters.outletTier) filterParts.push(`媒体分级=${filters.outletTier}`);
  if (filters.outletRegion) filterParts.push(`区域=${filters.outletRegion}`);
  if (filters.category) filterParts.push(`分类=${filters.category}`);
  if (filters.tag) filterParts.push(`标签=${filters.tag}`);
  if (filters.author) filterParts.push(`媒体/账号=${filters.author}`);
  const searchText = (filters.searchText ?? filters.titleKeyword)?.trim();
  if (searchText) filterParts.push(`二次搜索=${searchText}`);
  if (filterParts.length > 0) parts.push(`筛选条件: ${filterParts.join("；")}`);

  return parts.join("\n");
}

function joinList(values: Array<string | null | undefined> | null | undefined): string {
  return (values ?? []).filter(Boolean).join("、");
}

function formatExcelDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function formatFileDate(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}` +
    `_${pad(value.getHours())}${pad(value.getMinutes())}`
  );
}

function safeFileNamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "topic";
}

function truncateExcelText(value: string | null | undefined): string {
  if (!value) return "";
  return value.length > 30000 ? `${value.slice(0, 30000)}...` : value;
}

// ---------- Topic CRUD ----------

export async function createTopic(
  input: z.infer<typeof createTopicSchema>,
): Promise<Result<{ id: string }>> {
  try {
    const { userId, organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = createTopicSchema.parse(input);

    const [row] = await db
      .insert(researchTopics)
      .values({
        organizationId,
        createdBy: userId,
        name: data.name,
        description: data.description,
        sortOrder: data.sortOrder ?? 0,
        isPreset: false,
      })
      .returning({ id: researchTopics.id });

    revalidatePath("/data-collection/topics");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTopic(
  input: z.infer<typeof updateTopicSchema>,
): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = updateTopicSchema.parse(input);
    const { id, ...patch } = data;

    // 若改了 name —— topic.name 默认会作为 primaryKeyword 兜底,
    // 所以改名必须触发回算,否则旧命中可能不再正确。
    const nameChanged = typeof patch.name === "string" && patch.name.length > 0;

    await db
      .update(researchTopics)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(researchTopics.id, id),
          eq(researchTopics.organizationId, organizationId),
        ),
      );

    if (nameChanged) {
      await inngest.send({
        name: "research/topic.changed",
        data: { topicId: id, organizationId, reason: "topic-renamed" },
      });
    }

    revalidatePath("/data-collection/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTopic(id: string): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );

    // Guard: don't delete preset topics accidentally
    const [existing] = await db
      .select()
      .from(researchTopics)
      .where(
        and(
          eq(researchTopics.id, id),
          eq(researchTopics.organizationId, organizationId),
        ),
      );
    if (!existing) return { ok: false, error: "未找到主题" };
    if (existing.isPreset) {
      return { ok: false, error: "预置主题不可删除" };
    }

    await db.delete(researchTopics).where(eq(researchTopics.id, id));
    revalidatePath("/data-collection/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Keywords ----------

export async function addKeyword(
  input: z.infer<typeof addKeywordSchema>,
): Promise<Result<{ id: string }>> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = addKeywordSchema.parse(input);

    // Verify topic belongs to org
    const [topic] = await db
      .select({ id: researchTopics.id })
      .from(researchTopics)
      .where(
        and(
          eq(researchTopics.id, data.topicId),
          eq(researchTopics.organizationId, organizationId),
        ),
      );
    if (!topic) return { ok: false, error: "主题不存在或无权限" };

    const [row] = await db.transaction(async (tx) => {
      if (data.isPrimary) {
        await tx
          .update(researchTopicKeywords)
          .set({ isPrimary: false })
          .where(eq(researchTopicKeywords.topicId, data.topicId));
      }
      return tx
        .insert(researchTopicKeywords)
        .values({
          topicId: data.topicId,
          keyword: data.keyword,
          isPrimary: data.isPrimary ?? false,
        })
        .returning({ id: researchTopicKeywords.id });
    });

    // 新增 keyword 后,该 topic 的命中范围可能扩大 — 异步重算
    await inngest.send({
      name: "research/topic.changed",
      data: { topicId: data.topicId, organizationId, reason: "keyword-added" },
    });

    revalidatePath("/data-collection/topics");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateKeyword(
  input: z.infer<typeof updateKeywordSchema>,
): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = updateKeywordSchema.parse(input);

    const [kw] = await db
      .select({
        topicOrgId: researchTopics.organizationId,
        topicId: researchTopicKeywords.topicId,
      })
      .from(researchTopicKeywords)
      .innerJoin(
        researchTopics,
        eq(researchTopicKeywords.topicId, researchTopics.id),
      )
      .where(eq(researchTopicKeywords.id, data.id));
    if (!kw || kw.topicOrgId !== organizationId) {
      return { ok: false, error: "关键词不存在或无权限" };
    }
    if (data.keyword === undefined && data.isPrimary === undefined) {
      return { ok: true };
    }

    await db.transaction(async (tx) => {
      if (data.isPrimary) {
        await tx
          .update(researchTopicKeywords)
          .set({ isPrimary: false })
          .where(eq(researchTopicKeywords.topicId, kw.topicId));
      }
      await tx
        .update(researchTopicKeywords)
        .set({
          ...(data.keyword ? { keyword: data.keyword } : {}),
          ...(data.isPrimary !== undefined ? { isPrimary: data.isPrimary } : {}),
        })
        .where(eq(researchTopicKeywords.id, data.id));
    });

    await inngest.send({
      name: "research/topic.changed",
      data: { topicId: kw.topicId, organizationId, reason: "keyword-updated" },
    });

    revalidatePath("/data-collection/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeKeyword(id: string): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );

    // Scope check via join + 拿到 topicId(删除后才能派发回算事件)
    const [kw] = await db
      .select({
        topicOrgId: researchTopics.organizationId,
        topicId: researchTopicKeywords.topicId,
      })
      .from(researchTopicKeywords)
      .innerJoin(
        researchTopics,
        eq(researchTopicKeywords.topicId, researchTopics.id),
      )
      .where(eq(researchTopicKeywords.id, id));
    if (!kw || kw.topicOrgId !== organizationId) {
      return { ok: false, error: "关键词不存在或无权限" };
    }

    await db.delete(researchTopicKeywords).where(eq(researchTopicKeywords.id, id));

    // 删除 keyword 后,旧命中可能依赖该词 — 必须 reannotate 重置该 topic 命中
    await inngest.send({
      name: "research/topic.changed",
      data: { topicId: kw.topicId, organizationId, reason: "keyword-removed" },
    });

    revalidatePath("/data-collection/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Samples (with Inngest event emission) ----------

export async function addSample(
  input: z.infer<typeof addSampleSchema>,
): Promise<Result<{ id: string }>> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = addSampleSchema.parse(input);

    const [topic] = await db
      .select({ id: researchTopics.id })
      .from(researchTopics)
      .where(
        and(
          eq(researchTopics.id, data.topicId),
          eq(researchTopics.organizationId, organizationId),
        ),
      );
    if (!topic) return { ok: false, error: "主题不存在或无权限" };

    const [row] = await db
      .insert(researchTopicSamples)
      .values({
        topicId: data.topicId,
        sampleText: data.sampleText,
        embeddingStatus: "pending",
      })
      .returning({ id: researchTopicSamples.id });

    // Emit event for future Inngest vectorization listener (S3 will wire this)
    await inngest.send({
      name: "research/topic.sample.changed",
      data: { sampleId: row.id, topicId: data.topicId, operation: "created" },
    });

    revalidatePath("/data-collection/topics");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSample(
  input: z.infer<typeof updateSampleSchema>,
): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    const data = updateSampleSchema.parse(input);

    // Scope check via join
    const [sample] = await db
      .select({
        topicOrgId: researchTopics.organizationId,
        topicId: researchTopicSamples.topicId,
      })
      .from(researchTopicSamples)
      .innerJoin(
        researchTopics,
        eq(researchTopicSamples.topicId, researchTopics.id),
      )
      .where(eq(researchTopicSamples.id, data.id));
    if (!sample || sample.topicOrgId !== organizationId) {
      return { ok: false, error: "样本不存在或无权限" };
    }

    await db
      .update(researchTopicSamples)
      .set({
        sampleText: data.sampleText,
        embedding: null,
        embeddingStatus: "pending",
        updatedAt: new Date(),
      })
      .where(eq(researchTopicSamples.id, data.id));

    await inngest.send({
      name: "research/topic.sample.changed",
      data: {
        sampleId: data.id,
        topicId: sample.topicId,
        operation: "updated",
      },
    });

    revalidatePath("/data-collection/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeSample(id: string): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );

    const [sample] = await db
      .select({ topicOrgId: researchTopics.organizationId })
      .from(researchTopicSamples)
      .innerJoin(
        researchTopics,
        eq(researchTopicSamples.topicId, researchTopics.id),
      )
      .where(eq(researchTopicSamples.id, id));
    if (!sample || sample.topicOrgId !== organizationId) {
      return { ok: false, error: "样本不存在或无权限" };
    }

    await db.delete(researchTopicSamples).where(eq(researchTopicSamples.id, id));
    revalidatePath("/data-collection/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Backfill ----------

/**
 * 一次性触发:对该 org 全量历史 collected_items 跑 topic + district 匹配。
 *
 * 用途:
 *   - 首次建立词库后,把历史已采集的 items 回填命中
 *   - 异常恢复(annotation 表数据丢失)
 *   - 跨系统导入词库后批量初始化
 *
 * 注意:这是兜底操作,日常词库变更已由 reannotate-topic Inngest fn 自动覆盖,
 * 不需要每次都手动触发本 action。
 */
export async function requestBackfillAnnotate(): Promise<Result<{ enqueued: true }>> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );
    await inngest.send({
      name: "research/backfill-annotate.requested",
      data: { organizationId },
    });
    return { ok: true, enqueued: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Group ----------

/**
 * 设置主题的分组名（null 表示移出分组 / 默认分组）。
 * Phase 3a 新增,配合 /data-collection/topics 侧边栏分组 UI(Phase 3b)。
 */
export async function setTopicGroup(
  topicId: string,
  groupName: string | null,
): Promise<Result> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TOPIC_MANAGE,
    );

    await db
      .update(researchTopics)
      .set({ groupName, updatedAt: new Date() })
      .where(
        and(
          eq(researchTopics.id, topicId),
          eq(researchTopics.organizationId, organizationId),
        ),
      );

    revalidatePath("/data-collection/topics");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------- Detail fetch ----------

export async function getTopicDetail(id: string) {
  const { organizationId } = await requirePermission(
    PERMISSIONS.RESEARCH_TOPIC_MANAGE,
  );
  return getResearchTopicById(id, organizationId);
}

// ---------- Topic hits search (for /data-collection/topics detail panel) ----------

/**
 * 主题监测主从布局右栏专用:按 topicId 的主题名 + 关键词列表跨字段 OR 检索。
 * 额外筛选条件复用内容池 ContentFilters 映射,保证右栏与内容池检索口径一致。
 */
export async function searchCollectedItemsByTopicAction(
  topicId: string,
  filters: TopicSearchActionFilters,
  pagination: { limit: number; offset: number },
): Promise<{ items: CollectedItemWithAnnotations[]; total: number }> {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  const context = await loadTopicSearchContext(topicId, organizationId);
  if (!context) {
    return { items: [], total: 0 };
  }

  return searchCollectedItemsByTopicKeywords(
    organizationId,
    topicId,
    context.topicKeywords,
    mapTopicFiltersToContentFilters(filters),
    pagination,
  );
}

export async function exportTopicSearchResultsToExcelAction(
  topicId: string,
  filters: TopicSearchActionFilters,
): Promise<TopicExportExcelResult> {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  const context = await loadTopicSearchContext(topicId, organizationId);
  if (!context) throw new Error("主题不存在或无权限");

  const result = await searchCollectedItemsByTopicKeywords(
    organizationId,
    topicId,
    context.topicKeywords,
    mapTopicFiltersToContentFilters(filters),
    { limit: MAX_TOPIC_EXPORT_ITEMS, offset: 0 },
  );

  if (result.total > MAX_TOPIC_EXPORT_ITEMS) {
    throw new Error(
      `匹配 ${result.total} 条,超过单次导出上限 ${MAX_TOPIC_EXPORT_ITEMS} 条,请收紧筛选条件后再试`,
    );
  }

  const records = result.items.map((item, index) => ({
    序号: index + 1,
    标题: item.title,
    摘要内容: truncateExcelText(item.summary ?? item.content),
    命中关键词: joinList(item.topicMatchedKeywords),
    命中字段: joinList(item.topicHitFields),
    标签: joinList(item.tags),
    分类: joinList(item.category),
    媒体: item.outletName ?? "",
    账号: item.author ?? "",
    媒体分级: item.outletTier ?? "",
    区域: item.outletRegion ?? "",
    平台: item.platform ?? "",
    源类型: item.sourceType ?? "",
    发布时间: formatExcelDate(item.publishedAt),
    采集时间: formatExcelDate(item.firstSeenAt),
    链接: item.url ?? "",
  }));

  const XLSX = await import("@e965/xlsx");
  const sheet = XLSX.utils.json_to_sheet(records);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "主题命中");
  const buffer: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return {
    base64: buffer.toString("base64"),
    rowCount: records.length,
    fileName: `vibetide_topic_${safeFileNamePart(context.detail.topic.name)}_${formatFileDate(new Date())}.xlsx`,
  };
}

export async function createTopicReportAction(
  topicId: string,
  filters: TopicSearchActionFilters,
): Promise<{ reportId: string }> {
  const { organizationId, userId } = await requirePermission(
    PERMISSIONS.MENU_RESEARCH,
  );
  const context = await loadTopicSearchContext(topicId, organizationId);
  if (!context) throw new Error("主题不存在或无权限");

  const result = await searchCollectedItemsByTopicKeywords(
    organizationId,
    topicId,
    context.topicKeywords,
    mapTopicFiltersToContentFilters(filters),
    { limit: MAX_TOPIC_REPORT_ITEMS + 1, offset: 0 },
  );
  if (result.total === 0) throw new Error("没有命中数据可生成报告");
  if (result.total > MAX_TOPIC_REPORT_ITEMS) {
    throw new Error(
      `命中数据超过 ${MAX_TOPIC_REPORT_ITEMS} 条，请缩小检索条件后再生成报告`,
    );
  }

  const snapshot: ReportSearchSnapshot = {
    kind: "advanced_search",
    conditions: buildTopicReportConditions(filters),
    sidebarFilter: buildTopicReportSidebarFilter(topicId, filters),
    hitItemIds: result.items.map((item) => item.id),
    capturedAt: new Date().toISOString(),
  };

  const report = await createResearchReport({
    organizationId,
    searchSnapshot: snapshot,
    title: `${context.detail.topic.name}主题研究报告`,
    topicDescription: buildTopicReportDescription(
      context.detail,
      context.topicKeywords,
      filters,
      result.total,
    ),
    generatedBy: userId,
  });

  await inngest.send({
    name: "research/report.generate",
    data: { reportId: report.id, organizationId },
  });

  revalidatePath("/data-collection/reports");
  revalidatePath(`/data-collection/reports/${report.id}`);
  return { reportId: report.id };
}
