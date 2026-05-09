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

  return provider.search(query, options);
}
