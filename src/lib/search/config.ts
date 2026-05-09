import type { SearchProviderId } from "./types";

const VALID_PROVIDERS: readonly SearchProviderId[] = ["bocha", "tavily"] as const;

let warnedFallback = false;

/**
 * Resolve the active web search provider from env.
 * Defaults to "bocha" (国内可用、不需要代理).
 * Override per-call by passing forceProvider in SearchOptions.
 */
export function getActiveSearchProvider(): SearchProviderId {
  const raw = (process.env.SEARCH_PROVIDER ?? "").trim().toLowerCase();
  if ((VALID_PROVIDERS as readonly string[]).includes(raw)) {
    return raw as SearchProviderId;
  }
  if (raw && !warnedFallback) {
    warnedFallback = true;
    console.warn(
      `[search] SEARCH_PROVIDER="${raw}" not recognized; falling back to "bocha". ` +
        `Valid values: ${VALID_PROVIDERS.join(", ")}`,
    );
  }
  return "bocha";
}

const PROVIDER_ENV_KEY: Record<SearchProviderId, string> = {
  bocha: "BOCHA_API_KEY",
  tavily: "TAVILY_API_KEY",
};

/** True when the API key for the active (or specified) provider is set. */
export function isSearchProviderConfigured(provider?: SearchProviderId): boolean {
  const id = provider ?? getActiveSearchProvider();
  return Boolean(process.env[PROVIDER_ENV_KEY[id]]);
}
