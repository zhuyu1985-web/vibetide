/**
 * Application-layer semantic retrieval over knowledge base chunks.
 * Uses cosine similarity over jsonb-stored embedding vectors.
 *
 * V1 design: simple in-memory scoring, no pgvector. See design.md D2 for
 * the upgrade path when chunk count exceeds ~10k.
 */

import { loadEmbeddedKnowledgeItems } from "@/lib/dal/knowledge-bases";
import { generateQueryEmbedding } from "./embeddings";

export interface RetrievalHit {
  id: string;
  knowledgeBaseId: string;
  title: string;
  snippet: string;
  relevance: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Run a semantic search across one or more knowledge bases.
 * Returns top-K hits sorted by descending cosine similarity.
 */
export async function searchKnowledgeBases(
  query: string,
  kbIds: string[],
  topK = 5
): Promise<RetrievalHit[]> {
  if (kbIds.length === 0) return [];
  if (!query.trim()) return [];

  const [queryEmbedding, candidates] = await Promise.all([
    generateQueryEmbedding(query),
    loadEmbeddedKnowledgeItems(kbIds),
  ]);

  if (candidates.length === 0) return [];

  const scored = candidates.map((c) => ({
    id: c.id,
    knowledgeBaseId: c.knowledgeBaseId,
    title: c.title,
    snippet: c.snippet,
    relevance: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  scored.sort((a, b) => b.relevance - a.relevance);
  return scored.slice(0, Math.max(1, Math.min(50, topK)));
}
