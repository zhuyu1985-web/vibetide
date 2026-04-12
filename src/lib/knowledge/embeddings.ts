/**
 * Jina Embeddings API client.
 * Docs: https://api.jina.ai/v1/embeddings (jina-embeddings-v3)
 */

const JINA_EMBEDDINGS_URL = "https://api.jina.ai/v1/embeddings";
const DEFAULT_MODEL = "jina-embeddings-v3";
const DEFAULT_DIMENSIONS = 1024;
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

export function getEmbeddingModel(): string {
  return process.env.JINA_EMBEDDING_MODEL || DEFAULT_MODEL;
}

interface JinaEmbeddingResponse {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage?: { total_tokens: number };
}

async function callJinaEmbeddings(
  inputs: string[],
  model: string,
  apiKey: string
): Promise<number[][]> {
  const response = await fetch(JINA_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: inputs,
      dimensions: DEFAULT_DIMENSIONS,
      task: "retrieval.passage",
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Jina Embeddings API ${response.status}: ${text || response.statusText}`);
  }

  const json = (await response.json()) as JinaEmbeddingResponse;
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error("Jina Embeddings 返回数据格式异常");
  }

  // Sort by index to ensure ordering matches input
  const sorted = [...json.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

/**
 * Generate embeddings for a list of texts. Batches into chunks of 100,
 * retries up to 3 times with exponential backoff per batch.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    throw new Error("JINA_API_KEY 未配置");
  }
  if (texts.length === 0) return [];

  const model = getEmbeddingModel();
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const batchResults = await callJinaEmbeddings(batch, model, apiKey);
        results.push(...batchResults);
        lastError = null;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES - 1) {
          const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    if (lastError) {
      throw new Error(
        `Jina Embeddings 调用失败（已重试 ${MAX_RETRIES} 次）：${lastError.message}`
      );
    }
  }

  return results;
}

/**
 * Generate a single query embedding (different task type for retrieval queries).
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    throw new Error("JINA_API_KEY 未配置");
  }

  const model = getEmbeddingModel();

  const response = await fetch(JINA_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [query],
      dimensions: DEFAULT_DIMENSIONS,
      task: "retrieval.query",
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Jina Embeddings API ${response.status}: ${text || response.statusText}`);
  }

  const json = (await response.json()) as JinaEmbeddingResponse;
  if (!json.data?.[0]?.embedding) {
    throw new Error("Jina Embeddings 返回 query embedding 为空");
  }

  return json.data[0].embedding;
}
