import {
  type NewsFeedItem,
  type SearchOptions,
  type SearchProvider,
  type SearchResult,
  DEFAULT_INCLUDE_DOMAINS,
  inferCredibility,
  inferSourceType,
  parseDate,
} from "../types";

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score: number;
  published_date?: string;
}

interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  response_time: number;
}

const TIME_RANGE_MAP: Record<string, string> = {
  "1h": "day",
  "24h": "day",
  "7d": "week",
  "30d": "month",
};

export const tavilyProvider: SearchProvider = {
  id: "tavily",
  async search(query: string, options: SearchOptions): Promise<SearchResult> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY not configured");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const body: Record<string, unknown> = {
        query,
        search_depth: "advanced",
        include_answer: true,
        max_results: Math.min(options.maxResults ?? 8, 20),
        include_domains: options.includeDomains ?? DEFAULT_INCLUDE_DOMAINS,
      };

      if (options.topic) {
        body.topic = options.topic;
      }

      if (options.timeRange && options.timeRange !== "all") {
        body.time_range = TIME_RANGE_MAP[options.timeRange] || "week";
      }

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, ...body }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Tavily API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as TavilySearchResponse;

      const items: NewsFeedItem[] = data.results.map((r) => {
        const source = new URL(r.url).hostname.replace(/^www\./, "");
        const sourceType = inferSourceType(source, r.url);
        const { publishedAt, publishedAtMs } = r.published_date
          ? parseDate(r.published_date)
          : { publishedAt: null, publishedAtMs: null };

        return {
          title: r.title,
          snippet: r.content,
          url: r.url,
          source,
          publishedAt,
          publishedAtMs,
          engine: "google-news" as const,
          sourceType,
          credibility: inferCredibility(sourceType),
        };
      });

      return {
        items,
        answer: data.answer,
        responseTime: data.response_time,
        provider: "tavily",
      };
    } finally {
      clearTimeout(timeout);
    }
  },
};
