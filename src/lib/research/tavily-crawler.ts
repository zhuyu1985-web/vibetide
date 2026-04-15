import { searchViaTavily } from "@/lib/web-fetch";

export type TavilyArticleHit = {
  url: string;
  title: string;
  snippet: string;
  publishedAt: Date | null;
  rawMetadata: Record<string, unknown>;
};

/**
 * Query Tavily for one keyword within a time window, scoped to given include_domains.
 * Filters results to those whose publishedAt falls inside the window (when Tavily provides it).
 */
export async function crawlTavilyForKeyword(params: {
  keyword: string;
  includeDomains: string[];
  timeRangeStart: Date;
  timeRangeEnd: Date;
  maxResults?: number;
}): Promise<TavilyArticleHit[]> {
  // Map date window to Tavily's coarse time_range param (based on window age)
  const now = Date.now();
  const ageMs = now - params.timeRangeStart.getTime();
  let timeRange: "24h" | "7d" | "30d" | "all" = "all";
  if (ageMs < 86_400_000 * 2) timeRange = "24h";
  else if (ageMs < 86_400_000 * 10) timeRange = "7d";
  else if (ageMs < 86_400_000 * 40) timeRange = "30d";

  const { items } = await searchViaTavily(params.keyword, {
    timeRange,
    maxResults: params.maxResults ?? 20,
    topic: "news",
    include_domains: params.includeDomains,
  });

  const hits: TavilyArticleHit[] = [];
  for (const it of items) {
    const pubDate = it.publishedAt ? new Date(it.publishedAt) : null;
    if (pubDate && (pubDate < params.timeRangeStart || pubDate > params.timeRangeEnd)) continue;
    hits.push({
      url: it.url,
      title: it.title,
      snippet: it.snippet,
      publishedAt: pubDate,
      rawMetadata: { source: it.source, engine: it.engine, snippet: it.snippet },
    });
  }
  return hits;
}
