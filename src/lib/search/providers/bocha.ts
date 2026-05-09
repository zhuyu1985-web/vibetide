import {
  type NewsFeedItem,
  type SearchOptions,
  type SearchProvider,
  type SearchResult,
  type WebSearchTimeRange,
  DEFAULT_INCLUDE_DOMAINS,
  inferCredibility,
  inferSourceType,
  parseDate,
} from "../types";

// ---------------------------------------------------------------------------
// Bocha Web Search API
// Docs: https://open.bochaai.com  Endpoint: POST https://api.bochaai.com/v1/web-search
// Auth: Authorization: Bearer <BOCHA_API_KEY>
// ---------------------------------------------------------------------------

interface BochaWebPage {
  id: string;
  name: string;
  url: string;
  displayUrl: string;
  snippet: string;
  summary?: string;
  siteName: string;
  siteIcon: string;
  datePublished: string | null;
  dateLastCrawled: string | null;
  cachedPageUrl: string | null;
  language: string | null;
  isFamilyFriendly: boolean | null;
  isNavigational: boolean | null;
}

interface BochaResponse {
  code: number;
  log_id: string;
  msg: string | null;
  data: {
    _type: string;
    queryContext: { originalQuery: string };
    webPages?: {
      webSearchUrl: string;
      totalEstimatedMatches: number;
      value: BochaWebPage[];
      someResultsRemoved?: boolean;
    };
    images?: unknown;
    videos?: unknown;
  };
}

type BochaFreshness = "noLimit" | "oneDay" | "oneWeek" | "oneMonth" | "oneYear";

const FRESHNESS_MAP: Record<WebSearchTimeRange, BochaFreshness> = {
  "1h": "oneDay", // Bocha 最细粒度仅到天
  "24h": "oneDay",
  "7d": "oneWeek",
  "30d": "oneMonth",
  all: "noLimit",
};

const BOCHA_MAX_COUNT = 50;
// Bocha 不原生支持 include_domains —— 客户端过滤会损失召回；
// 5× 是 narrow whitelist (≤5 站点) 与 wide whitelist (≥20 站点) 的折中点。
const DOMAIN_OVERFETCH_MULTIPLIER = 5;

function normalizeHostname(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
}

function matchesDomain(url: string, allowList: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return false;
  }
  return allowList.some((domain) => {
    const norm = normalizeHostname(domain);
    return host === norm || host.endsWith(`.${norm}`);
  });
}

export const bochaProvider: SearchProvider = {
  id: "bocha",
  async search(query: string, options: SearchOptions): Promise<SearchResult> {
    const apiKey = process.env.BOCHA_API_KEY;
    if (!apiKey) throw new Error("BOCHA_API_KEY not configured");

    const requestedMax = Math.min(options.maxResults ?? 8, 20);
    const filterDomains = options.includeDomains ?? DEFAULT_INCLUDE_DOMAINS;
    const applyDomainFilter = filterDomains.length > 0;

    // Bocha 不原生支持 include_domains —— 域名白名单走 client-side 过滤；为补偿召回率，over-fetch
    const fetchCount = applyDomainFilter
      ? Math.min(requestedMax * DOMAIN_OVERFETCH_MULTIPLIER, BOCHA_MAX_COUNT)
      : requestedMax;

    const freshness = options.timeRange ? FRESHNESS_MAP[options.timeRange] : "noLimit";

    const body: Record<string, unknown> = {
      query,
      summary: true, // 索取更长正文摘要
      count: fetchCount,
    };
    if (freshness !== "noLimit") {
      body.freshness = freshness;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const startedAt = Date.now();
    try {
      const response = await fetch("https://api.bochaai.com/v1/web-search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        throw new Error(
          `Bocha API returned ${response.status}: ${response.statusText} ${errBody.slice(0, 200)}`,
        );
      }

      const json = (await response.json()) as BochaResponse;
      if (json.code !== 200 && json.code !== 0) {
        throw new Error(`Bocha API logical error code=${json.code} msg=${json.msg ?? ""}`);
      }

      const pages = json.data?.webPages?.value ?? [];
      const filtered = applyDomainFilter
        ? pages.filter((p) => matchesDomain(p.url, filterDomains))
        : pages;

      const items: NewsFeedItem[] = filtered.slice(0, requestedMax).map((p) => {
        let host = "";
        try {
          host = new URL(p.url).hostname.replace(/^www\./i, "");
        } catch {
          host = p.siteName || "";
        }
        const source = p.siteName || host;
        const sourceType = inferSourceType(source, p.url);
        const { publishedAt, publishedAtMs } = p.datePublished
          ? parseDate(p.datePublished)
          : { publishedAt: null, publishedAtMs: null };

        return {
          title: p.name,
          snippet: p.summary ?? p.snippet ?? "",
          url: p.url,
          source,
          publishedAt,
          publishedAtMs,
          engine: "bocha" as const,
          sourceType,
          credibility: inferCredibility(sourceType),
        };
      });

      return {
        items,
        responseTime: (Date.now() - startedAt) / 1000,
        provider: "bocha",
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
