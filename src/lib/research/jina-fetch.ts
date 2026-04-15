import { fetchViaJinaReader } from "@/lib/web-fetch";

export type FetchedArticle = {
  url: string;
  title: string;
  content: string;
};

/**
 * Fetch article content via Jina Reader with linear-backoff retry.
 * Returns null on permanent failure (after retries exhausted or empty content).
 */
export async function fetchArticleContent(
  url: string,
  opts: { maxRetries?: number; backoffMs?: number } = {},
): Promise<FetchedArticle | null> {
  const maxRetries = opts.maxRetries ?? 2;
  const backoffMs = opts.backoffMs ?? 1000;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchViaJinaReader(url);
      if (res.content && res.content.length > 0) {
        return { url, title: res.title, content: res.content };
      }
      return null;
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }
  console.warn(`[research] Jina fetch failed for ${url}:`, lastError);
  return null;
}
