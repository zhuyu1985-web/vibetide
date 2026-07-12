import { getActiveSearchProvider } from "./config";
import { bochaProvider } from "./providers/bocha";
import { tavilyProvider } from "./providers/tavily";
import type { SearchOptions, SearchProvider, SearchProviderId, SearchResult } from "./types";

export type {
  Credibility,
  NewsFeedItem,
  SearchEngine,
  SearchOptions,
  SearchProvider,
  SearchProviderId,
  SearchResult,
  SourceType,
  WebSearchTimeRange,
} from "./types";
export { DEFAULT_INCLUDE_DOMAINS, inferCredibility, inferSourceType, parseDate } from "./types";
export { getActiveSearchProvider, isSearchProviderConfigured } from "./config";

const REGISTRY: Record<SearchProviderId, SearchProvider> = {
  bocha: bochaProvider,
  tavily: tavilyProvider,
};

let lastLoggedProvider: SearchProviderId | null = null;

export function isRetryableSearchError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const message = error instanceof Error ? error.message : String(error);
  if (/quota|rate.?limit|401|403|400|invalid|not configured/i.test(message)) {
    return false;
  }
  return (
    /\b5\d{2}\b/.test(message) ||
    /timeout|timed out|abort|fetch failed|ECONNRESET|ECONNREFUSED|EAI_AGAIN/i.test(
      message,
    )
  );
}

export async function runSearchWithRetry<T>(
  operation: () => Promise<T>,
  delayMs = 250,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableSearchError(error)) throw error;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return operation();
  }
}

/**
 * Run a web search via the currently active provider.
 *
 * Provider selection precedence:
 *   1. options.forceProvider (used by collection adapters that bind to a specific engine)
 *   2. process.env.SEARCH_PROVIDER ("bocha" | "tavily")
 *   3. default "bocha"
 */
export async function searchWeb(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const providerId: SearchProviderId = options.forceProvider ?? getActiveSearchProvider();
  const provider = REGISTRY[providerId];
  if (!provider) {
    throw new Error(`Unknown search provider: ${providerId}`);
  }

  if (!options.forceProvider && lastLoggedProvider !== providerId) {
    lastLoggedProvider = providerId;
    console.info(`[search] active provider: ${providerId}`);
  }

  return runSearchWithRetry(() => provider.search(query, options));
}
