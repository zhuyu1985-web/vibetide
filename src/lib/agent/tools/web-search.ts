import { searchWeb, isSearchProviderConfigured } from "@/lib/search";

/**
 * Web search tool — runs against the configured provider (SEARCH_PROVIDER env: bocha | tavily).
 * Falls back to an explanatory empty result when no provider is configured.
 */
export async function webSearch(query: string, maxResults: number = 5) {
  if (!isSearchProviderConfigured()) {
    return {
      query,
      results: [],
      warning: "No web search provider configured (set SEARCH_PROVIDER and BOCHA_API_KEY or TAVILY_API_KEY).",
    };
  }

  const { items, provider } = await searchWeb(query, { maxResults, topic: "news" });

  return {
    query,
    provider,
    results: items.map((it) => ({
      title: it.title,
      snippet: it.snippet,
      url: it.url,
      source: it.source,
      publishedAt: it.publishedAt,
    })),
  };
}
