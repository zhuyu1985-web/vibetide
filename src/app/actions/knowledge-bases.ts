"use server";

import { db } from "@/db";
import {
  knowledgeBases,
  knowledgeItems,
  knowledgeSyncLogs,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { assertKnowledgeBaseOwnership } from "@/lib/dal/knowledge-bases";
import { chunkText, buildSnippet } from "@/lib/knowledge/chunking";
import { fetchViaJinaReader } from "@/lib/web-fetch";
import { inngest } from "@/inngest/client";

// ---------------------------------------------------------------------------
// Auth helpers (multi-tenant boundary)
// ---------------------------------------------------------------------------
async function requireOrg(): Promise<string> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  return orgId;
}

// ---------------------------------------------------------------------------
// Sync log helper
// ---------------------------------------------------------------------------

async function writeSyncLog(
  kbId: string,
  action: string,
  status: "success" | "error" | "warning",
  detail: string,
  counts: { documentsProcessed?: number; chunksGenerated?: number; errorsCount?: number } = {}
) {
  await db.insert(knowledgeSyncLogs).values({
    knowledgeBaseId: kbId,
    action,
    status,
    detail,
    documentsProcessed: counts.documentsProcessed || 0,
    chunksGenerated: counts.chunksGenerated || 0,
    errorsCount: counts.errorsCount || 0,
  });
}

// ---------------------------------------------------------------------------
// KB CRUD
// ---------------------------------------------------------------------------

export async function createKnowledgeBase(input: {
  name: string;
  description?: string;
  type?: string;
}) {
  const orgId = await requireOrg();

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error("知识库名称不能为空");
  if (trimmedName.length > 100) throw new Error("知识库名称过长");

  const [created] = await db
    .insert(knowledgeBases)
    .values({
      organizationId: orgId,
      name: trimmedName,
      description: input.description?.trim() || null,
      type: input.type || "general",
      vectorizationStatus: "pending",
      sourceType: "upload",
    })
    .returning();

  await writeSyncLog(created.id, "created", "success", `知识库 ${trimmedName} 已创建`);

  revalidatePath("/knowledge-bases");
  return created;
}

export async function updateKnowledgeBase(
  id: string,
  input: { name?: string; description?: string; type?: string }
) {
  const orgId = await requireOrg();
  await assertKnowledgeBaseOwnership(orgId, id);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("知识库名称不能为空");
    if (trimmed.length > 100) throw new Error("知识库名称过长");
    updates.name = trimmed;
  }
  if (input.description !== undefined) {
    updates.description = input.description.trim() || null;
  }
  if (input.type !== undefined) {
    updates.type = input.type;
  }

  await db.update(knowledgeBases).set(updates).where(eq(knowledgeBases.id, id));

  revalidatePath("/knowledge-bases");
  revalidatePath(`/knowledge-bases/${id}`);
}

export async function deleteKnowledgeBase(id: string) {
  const orgId = await requireOrg();
  await assertKnowledgeBaseOwnership(orgId, id);

  // Cascade deletes handle knowledge_items, employee_knowledge_bases, sync_logs
  await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));

  revalidatePath("/knowledge-bases");
}

// ---------------------------------------------------------------------------
// Knowledge Item ingestion
// ---------------------------------------------------------------------------

interface IngestResult {
  itemsCreated: number;
  chunksCreated: number;
}

async function ingestDocument(
  kbId: string,
  input: {
    title: string;
    content: string;
    sourceType?: "upload" | "cms" | "subscription";
    sourceDocument?: string | null;
    sourceUrl?: string | null;
    tags?: string[];
  }
): Promise<IngestResult> {
  const trimmedTitle = input.title.trim();
  const trimmedContent = input.content.trim();

  if (!trimmedTitle) throw new Error("文档标题不能为空");
  if (trimmedContent.length < 10) throw new Error("文档内容太短");

  const chunks = chunkText(trimmedContent);
  if (chunks.length === 0) throw new Error("文档内容无法切分");

  // Get current max chunk_index for this KB to continue numbering
  const maxIdxRow = await db
    .select({ max: sql<number>`COALESCE(MAX(${knowledgeItems.chunkIndex}), -1)::int` })
    .from(knowledgeItems)
    .where(eq(knowledgeItems.knowledgeBaseId, kbId));
  const startIndex = Number(maxIdxRow[0]?.max ?? -1) + 1;

  const rows = chunks.map((chunk, idx) => ({
    knowledgeBaseId: kbId,
    title: chunks.length > 1 ? `${trimmedTitle} #${idx + 1}` : trimmedTitle,
    snippet: buildSnippet(chunk),
    fullContent: chunk,
    sourceDocument: input.sourceDocument ?? trimmedTitle,
    sourceType: input.sourceType ?? "upload",
    chunkIndex: startIndex + idx,
    tags: input.tags ?? [],
  }));

  await db.insert(knowledgeItems).values(rows);

  // Update KB counters
  await db
    .update(knowledgeBases)
    .set({
      documentCount: sql`${knowledgeBases.documentCount} + 1`,
      chunkCount: sql`${knowledgeBases.chunkCount} + ${chunks.length}`,
      vectorizationStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBases.id, kbId));

  return { itemsCreated: 1, chunksCreated: chunks.length };
}

export async function addKnowledgeItem(
  kbId: string,
  input: {
    title: string;
    content: string;
    sourceDocument?: string;
    tags?: string[];
  }
) {
  const orgId = await requireOrg();
  await assertKnowledgeBaseOwnership(orgId, kbId);

  try {
    const result = await ingestDocument(kbId, {
      title: input.title,
      content: input.content,
      sourceType: "upload",
      sourceDocument: input.sourceDocument,
      tags: input.tags,
    });

    await writeSyncLog(
      kbId,
      "ingest",
      "success",
      `添加文档「${input.title}」，生成 ${result.chunksCreated} 个 chunks`,
      { documentsProcessed: 1, chunksGenerated: result.chunksCreated }
    );

    await inngest.send({
      name: "kb/document-created",
      data: { knowledgeBaseId: kbId, organizationId: orgId },
    });

    revalidatePath(`/knowledge-bases/${kbId}`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeSyncLog(kbId, "ingest", "error", `添加文档失败：${msg}`, { errorsCount: 1 });
    throw err;
  }
}

export async function crawlUrlIntoKB(kbId: string, url: string) {
  const orgId = await requireOrg();
  await assertKnowledgeBaseOwnership(orgId, kbId);

  const trimmedUrl = url.trim();
  try {
    new URL(trimmedUrl);
  } catch {
    throw new Error("URL 格式无效");
  }

  try {
    const { title, content } = await fetchViaJinaReader(trimmedUrl);
    if (!content || content.length < 50) {
      throw new Error("Jina Reader 返回正文为空或过短");
    }

    const finalTitle = title || new URL(trimmedUrl).hostname;
    const result = await ingestDocument(kbId, {
      title: finalTitle,
      content,
      sourceType: "subscription",
      sourceDocument: finalTitle,
      sourceUrl: trimmedUrl,
    });

    await writeSyncLog(
      kbId,
      "ingest",
      "success",
      `URL 爬取成功：${trimmedUrl}，生成 ${result.chunksCreated} 个 chunks`,
      { documentsProcessed: 1, chunksGenerated: result.chunksCreated }
    );

    await inngest.send({
      name: "kb/document-created",
      data: { knowledgeBaseId: kbId, organizationId: orgId },
    });

    revalidatePath(`/knowledge-bases/${kbId}`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await writeSyncLog(kbId, "ingest", "error", `URL 爬取失败：${trimmedUrl} - ${msg}`, {
      errorsCount: 1,
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Knowledge Item updates
// ---------------------------------------------------------------------------

export async function updateKnowledgeItem(
  itemId: string,
  input: { title?: string; content?: string; tags?: string[] }
) {
  const orgId = await requireOrg();

  // Verify item belongs to a KB owned by org
  const item = await db.query.knowledgeItems.findFirst({
    where: eq(knowledgeItems.id, itemId),
  });
  if (!item) throw new Error("文档不存在");
  await assertKnowledgeBaseOwnership(orgId, item.knowledgeBaseId);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.content !== undefined) {
    const trimmed = input.content.trim();
    updates.fullContent = trimmed;
    updates.snippet = buildSnippet(trimmed);
    // Clear embedding so it gets re-vectorized
    updates.embedding = null;
    updates.embeddingModel = null;
  }
  if (input.tags !== undefined) updates.tags = input.tags;

  await db.update(knowledgeItems).set(updates).where(eq(knowledgeItems.id, itemId));

  // If content changed, KB status drops to pending
  if (input.content !== undefined) {
    await db
      .update(knowledgeBases)
      .set({ vectorizationStatus: "pending", updatedAt: new Date() })
      .where(eq(knowledgeBases.id, item.knowledgeBaseId));

    await inngest.send({
      name: "kb/document-updated",
      data: {
        knowledgeBaseId: item.knowledgeBaseId,
        itemId,
        organizationId: orgId,
      },
    });
  }

  revalidatePath(`/knowledge-bases/${item.knowledgeBaseId}`);
}

export async function deleteKnowledgeItem(itemId: string) {
  const orgId = await requireOrg();

  const item = await db.query.knowledgeItems.findFirst({
    where: eq(knowledgeItems.id, itemId),
  });
  if (!item) throw new Error("文档不存在");
  await assertKnowledgeBaseOwnership(orgId, item.knowledgeBaseId);

  await db.delete(knowledgeItems).where(eq(knowledgeItems.id, itemId));

  // Recompute counts (simpler than tracking deltas)
  const countRow = await db
    .select({ c: sql<number>`COUNT(*)::int` })
    .from(knowledgeItems)
    .where(eq(knowledgeItems.knowledgeBaseId, item.knowledgeBaseId));
  const newChunkCount = Number(countRow[0]?.c || 0);

  await db
    .update(knowledgeBases)
    .set({
      chunkCount: newChunkCount,
      updatedAt: new Date(),
    })
    .where(eq(knowledgeBases.id, item.knowledgeBaseId));

  revalidatePath(`/knowledge-bases/${item.knowledgeBaseId}`);
}

// ---------------------------------------------------------------------------
// Reindex (rebuild embeddings for an entire KB)
// ---------------------------------------------------------------------------

export async function reindexKnowledgeBase(kbId: string) {
  const orgId = await requireOrg();
  await assertKnowledgeBaseOwnership(orgId, kbId);

  // Clear all embeddings
  await db
    .update(knowledgeItems)
    .set({ embedding: null, embeddingModel: null })
    .where(eq(knowledgeItems.knowledgeBaseId, kbId));

  await db
    .update(knowledgeBases)
    .set({ vectorizationStatus: "pending", updatedAt: new Date() })
    .where(eq(knowledgeBases.id, kbId));

  await writeSyncLog(kbId, "reindex", "success", "已请求重建索引");

  await inngest.send({
    name: "kb/reindex-requested",
    data: { knowledgeBaseId: kbId, organizationId: orgId },
  });

  revalidatePath(`/knowledge-bases/${kbId}`);
}
