import { inngest } from "../client";
import { db } from "@/db";
import { knowledgeBases, knowledgeItems, knowledgeSyncLogs } from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { generateEmbeddings, getEmbeddingModel } from "@/lib/knowledge/embeddings";

const BATCH_SIZE = 50;

/**
 * Async vectorization pipeline for knowledge base documents.
 * Triggered by:
 *   - kb/document-created  (after addKnowledgeItem / crawlUrlIntoKB)
 *   - kb/document-updated  (after updateKnowledgeItem)
 *   - kb/reindex-requested (after reindexKnowledgeBase)
 *
 * Loads all chunks with embedding=null for the target KB, batches them
 * into Jina API calls, writes results back, and updates KB status.
 */
export const knowledgeBaseVectorize = inngest.createFunction(
  {
    id: "knowledge-base-vectorize",
    name: "Knowledge Base Vectorization",
    concurrency: { limit: 2 },
    retries: 2,
  },
  [
    { event: "kb/document-created" },
    { event: "kb/document-updated" },
    { event: "kb/reindex-requested" },
  ],
  async ({ event, step }) => {
    const kbId = event.data.knowledgeBaseId;

    // 1. Mark KB as processing
    await step.run("mark-processing", async () => {
      await db
        .update(knowledgeBases)
        .set({ vectorizationStatus: "processing", updatedAt: new Date() })
        .where(eq(knowledgeBases.id, kbId));
    });

    // 2. Loop until no more pending chunks
    let totalProcessed = 0;
    let batchNum = 0;
    let hasError = false;
    let lastError = "";

    while (true) {
      const pending = await step.run(`load-pending-batch-${batchNum}`, async () => {
        return db
          .select({
            id: knowledgeItems.id,
            fullContent: knowledgeItems.fullContent,
          })
          .from(knowledgeItems)
          .where(
            and(
              eq(knowledgeItems.knowledgeBaseId, kbId),
              isNull(knowledgeItems.embedding)
            )
          )
          .limit(BATCH_SIZE);
      });

      if (pending.length === 0) break;

      try {
        const texts = pending.map((p) => p.fullContent || "");
        const embeddings = await step.run(`embed-batch-${batchNum}`, async () =>
          generateEmbeddings(texts)
        );

        const model = getEmbeddingModel();
        await step.run(`write-batch-${batchNum}`, async () => {
          for (let i = 0; i < pending.length; i++) {
            await db
              .update(knowledgeItems)
              .set({
                embedding: embeddings[i],
                embeddingModel: model,
                updatedAt: new Date(),
              })
              .where(eq(knowledgeItems.id, pending[i].id));
          }
        });

        totalProcessed += pending.length;
        batchNum++;

        // If batch was smaller than BATCH_SIZE, we're done
        if (pending.length < BATCH_SIZE) break;
      } catch (err) {
        hasError = true;
        lastError = err instanceof Error ? err.message : String(err);
        break;
      }
    }

    // 3. Final status update + log
    await step.run("finalize", async () => {
      const finalStatus = hasError ? "failed" : "done";

      // Recompute chunk count
      const countRow = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(knowledgeItems)
        .where(eq(knowledgeItems.knowledgeBaseId, kbId));
      const totalChunks = Number(countRow[0]?.c || 0);

      await db
        .update(knowledgeBases)
        .set({
          vectorizationStatus: finalStatus,
          chunkCount: totalChunks,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(knowledgeBases.id, kbId));

      await db.insert(knowledgeSyncLogs).values({
        knowledgeBaseId: kbId,
        action: "vectorize",
        status: hasError ? "error" : "success",
        detail: hasError
          ? `向量化失败：${lastError}`
          : `成功生成 ${totalProcessed} 个 chunks 的向量`,
        chunksGenerated: totalProcessed,
        errorsCount: hasError ? 1 : 0,
      });
    });

    return {
      kbId,
      processed: totalProcessed,
      status: hasError ? "failed" : "done",
      error: hasError ? lastError : null,
    };
  }
);
