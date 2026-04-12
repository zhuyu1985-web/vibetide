import { db } from "@/db";
import {
  knowledgeBases,
  knowledgeItems,
  knowledgeSyncLogs,
  employeeKnowledgeBases,
  aiEmployees,
} from "@/db/schema";
import { eq, and, desc, sql, ilike, notInArray, inArray, or, isNotNull } from "drizzle-orm";
import type {
  KnowledgeBaseInfo,
  KBSummary,
  KBDetail,
  KBItemListResult,
  KBSyncLogRow,
  KBBindingRow,
  KBVectorizationStatus,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Legacy reads (kept for backward compatibility with employee profile)
// ---------------------------------------------------------------------------

export async function getKnowledgeBases(): Promise<KnowledgeBaseInfo[]> {
  const rows = await db.query.knowledgeBases.findMany({
    orderBy: (kb, { asc }) => [asc(kb.name)],
  });

  return rows.map((kb) => ({
    id: kb.id,
    name: kb.name,
    description: kb.description || "",
    type: kb.type,
    documentCount: kb.documentCount || 0,
  }));
}

export async function getKnowledgeBasesNotBoundToEmployee(
  employeeId: string
): Promise<KnowledgeBaseInfo[]> {
  const boundRows = await db
    .select({ kbId: employeeKnowledgeBases.knowledgeBaseId })
    .from(employeeKnowledgeBases)
    .where(eq(employeeKnowledgeBases.employeeId, employeeId));

  const boundIds = boundRows.map((r) => r.kbId);

  const rows = boundIds.length > 0
    ? await db.query.knowledgeBases.findMany({
        where: notInArray(knowledgeBases.id, boundIds),
        orderBy: (kb, { asc }) => [asc(kb.name)],
      })
    : await db.query.knowledgeBases.findMany({
        orderBy: (kb, { asc }) => [asc(kb.name)],
      });

  return rows.map((kb) => ({
    id: kb.id,
    name: kb.name,
    description: kb.description || "",
    type: kb.type,
    documentCount: kb.documentCount || 0,
  }));
}

export async function getEmployeeKnowledgeBases(
  employeeId: string
): Promise<KnowledgeBaseInfo[]> {
  const rows = await db.query.employeeKnowledgeBases.findMany({
    where: eq(employeeKnowledgeBases.employeeId, employeeId),
    with: {
      knowledgeBase: true,
    },
  });

  return rows.map((ekb) => ({
    id: ekb.knowledgeBase.id,
    name: ekb.knowledgeBase.name,
    description: ekb.knowledgeBase.description || "",
    type: ekb.knowledgeBase.type,
    documentCount: ekb.knowledgeBase.documentCount || 0,
  }));
}

// ---------------------------------------------------------------------------
// Management module reads (multi-tenant scoped)
// ---------------------------------------------------------------------------

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return "";
  return value instanceof Date ? value.toISOString() : value;
}

function toIsoStringNullable(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/**
 * List all KB summaries for an organization with aggregated counts.
 */
export async function listKnowledgeBaseSummariesByOrg(
  organizationId: string
): Promise<KBSummary[]> {
  const rows = await db
    .select({
      id: knowledgeBases.id,
      name: knowledgeBases.name,
      description: knowledgeBases.description,
      type: knowledgeBases.type,
      documentCount: knowledgeBases.documentCount,
      chunkCount: knowledgeBases.chunkCount,
      vectorizationStatus: knowledgeBases.vectorizationStatus,
      lastSyncAt: knowledgeBases.lastSyncAt,
      createdAt: knowledgeBases.createdAt,
      updatedAt: knowledgeBases.updatedAt,
      boundCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${employeeKnowledgeBases}
        WHERE ${employeeKnowledgeBases.knowledgeBaseId} = ${knowledgeBases.id}
      )`,
    })
    .from(knowledgeBases)
    .where(eq(knowledgeBases.organizationId, organizationId))
    .orderBy(desc(knowledgeBases.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description || "",
    type: r.type,
    documentCount: r.documentCount || 0,
    chunkCount: r.chunkCount || 0,
    vectorizationStatus: r.vectorizationStatus as KBVectorizationStatus,
    boundEmployeeCount: Number(r.boundCount || 0),
    lastSyncAt: toIsoStringNullable(r.lastSyncAt),
    updatedAt: toIsoString(r.updatedAt),
    createdAt: toIsoString(r.createdAt),
  }));
}

/**
 * Single KB detail. Returns null if not found or not in the org.
 */
export async function getKnowledgeBaseById(
  organizationId: string,
  id: string
): Promise<KBDetail | null> {
  const row = await db.query.knowledgeBases.findFirst({
    where: and(
      eq(knowledgeBases.id, id),
      eq(knowledgeBases.organizationId, organizationId)
    ),
  });

  if (!row) return null;

  const boundCountResult = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(employeeKnowledgeBases)
    .where(eq(employeeKnowledgeBases.knowledgeBaseId, id));

  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    type: row.type,
    documentCount: row.documentCount || 0,
    chunkCount: row.chunkCount || 0,
    vectorizationStatus: row.vectorizationStatus as KBVectorizationStatus,
    boundEmployeeCount: Number(boundCountResult[0]?.count || 0),
    lastSyncAt: toIsoStringNullable(row.lastSyncAt),
    updatedAt: toIsoString(row.updatedAt),
    createdAt: toIsoString(row.createdAt),
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
  };
}

/**
 * Verify a KB belongs to the given organization. Throws if not.
 */
export async function assertKnowledgeBaseOwnership(
  organizationId: string,
  kbId: string
): Promise<void> {
  const found = await db
    .select({ id: knowledgeBases.id })
    .from(knowledgeBases)
    .where(
      and(
        eq(knowledgeBases.id, kbId),
        eq(knowledgeBases.organizationId, organizationId)
      )
    )
    .limit(1);

  if (found.length === 0) {
    throw new Error("知识库不存在或无权访问");
  }
}

/**
 * Paginated list of items in a KB with optional search and tag filter.
 */
export async function listKnowledgeItems(
  organizationId: string,
  kbId: string,
  opts: { page?: number; pageSize?: number; search?: string; tag?: string } = {}
): Promise<KBItemListResult> {
  await assertKnowledgeBaseOwnership(organizationId, kbId);

  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions = [eq(knowledgeItems.knowledgeBaseId, kbId)];
  if (opts.search && opts.search.trim()) {
    const term = `%${opts.search.trim()}%`;
    conditions.push(
      or(
        ilike(knowledgeItems.title, term),
        ilike(knowledgeItems.snippet, term)
      )!
    );
  }
  if (opts.tag) {
    conditions.push(sql`${knowledgeItems.tags} @> ${JSON.stringify([opts.tag])}::jsonb`);
  }

  const where = and(...conditions);

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: knowledgeItems.id,
        title: knowledgeItems.title,
        snippet: knowledgeItems.snippet,
        fullContent: knowledgeItems.fullContent,
        sourceDocument: knowledgeItems.sourceDocument,
        sourceType: knowledgeItems.sourceType,
        tags: knowledgeItems.tags,
        chunkIndex: knowledgeItems.chunkIndex,
        embedding: knowledgeItems.embedding,
        createdAt: knowledgeItems.createdAt,
      })
      .from(knowledgeItems)
      .where(where)
      .orderBy(desc(knowledgeItems.createdAt), knowledgeItems.chunkIndex)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(knowledgeItems)
      .where(where),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title || "",
      snippet: r.snippet || "",
      fullContent: r.fullContent || "",
      sourceDocument: r.sourceDocument,
      sourceType: r.sourceType,
      tags: (r.tags as string[]) || [],
      chunkIndex: r.chunkIndex || 0,
      hasEmbedding: r.embedding !== null && r.embedding !== undefined,
      createdAt: toIsoString(r.createdAt),
    })),
    total: Number(totalRow[0]?.count || 0),
    page,
    pageSize,
  };
}

/**
 * AI employees bound to this KB.
 */
export async function getKnowledgeBaseBindings(
  organizationId: string,
  kbId: string
): Promise<KBBindingRow[]> {
  await assertKnowledgeBaseOwnership(organizationId, kbId);

  const rows = await db
    .select({
      employeeDbId: aiEmployees.id,
      employeeSlug: aiEmployees.slug,
      employeeName: aiEmployees.name,
      employeeNickname: aiEmployees.nickname,
    })
    .from(employeeKnowledgeBases)
    .innerJoin(
      aiEmployees,
      eq(employeeKnowledgeBases.employeeId, aiEmployees.id)
    )
    .where(
      and(
        eq(employeeKnowledgeBases.knowledgeBaseId, kbId),
        eq(aiEmployees.organizationId, organizationId)
      )
    )
    .orderBy(aiEmployees.name);

  return rows.map((r) => ({
    employeeDbId: r.employeeDbId,
    employeeSlug: r.employeeSlug,
    employeeName: r.employeeName,
    employeeNickname: r.employeeNickname || r.employeeName,
  }));
}

/**
 * Recent sync logs for a KB.
 */
export async function getKnowledgeBaseSyncLogs(
  organizationId: string,
  kbId: string,
  limit = 50
): Promise<KBSyncLogRow[]> {
  await assertKnowledgeBaseOwnership(organizationId, kbId);

  const rows = await db
    .select()
    .from(knowledgeSyncLogs)
    .where(eq(knowledgeSyncLogs.knowledgeBaseId, kbId))
    .orderBy(desc(knowledgeSyncLogs.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    status: r.status as "success" | "error" | "warning",
    detail: r.detail || "",
    documentsProcessed: r.documentsProcessed || 0,
    chunksGenerated: r.chunksGenerated || 0,
    errorsCount: r.errorsCount || 0,
    createdAt: toIsoString(r.createdAt),
  }));
}

/**
 * Load all knowledge_items with embeddings for a set of KBs (used by retrieval tool).
 * Returns lightweight rows for in-memory cosine similarity scoring.
 */
export async function loadEmbeddedKnowledgeItems(
  kbIds: string[]
): Promise<
  Array<{
    id: string;
    knowledgeBaseId: string;
    title: string;
    snippet: string;
    embedding: number[];
  }>
> {
  if (kbIds.length === 0) return [];

  const rows = await db
    .select({
      id: knowledgeItems.id,
      knowledgeBaseId: knowledgeItems.knowledgeBaseId,
      title: knowledgeItems.title,
      snippet: knowledgeItems.snippet,
      embedding: knowledgeItems.embedding,
    })
    .from(knowledgeItems)
    .where(
      and(
        inArray(knowledgeItems.knowledgeBaseId, kbIds),
        isNotNull(knowledgeItems.embedding)
      )
    );

  return rows
    .filter((r) => Array.isArray(r.embedding) && r.embedding.length > 0)
    .map((r) => ({
      id: r.id,
      knowledgeBaseId: r.knowledgeBaseId,
      title: r.title || "",
      snippet: r.snippet || "",
      embedding: r.embedding as number[],
    }));
}
