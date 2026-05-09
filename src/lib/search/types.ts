// ---------------------------------------------------------------------------
// Web search types — shared across providers (Tavily, Bocha, ...).
// ---------------------------------------------------------------------------

export type SourceType = "official" | "industry" | "social" | "news" | "unknown";
export type Credibility = "high" | "medium" | "low";

export type SearchEngine = "google-news" | "bing-news" | "bocha";

export interface NewsFeedItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  publishedAt: string | null;
  publishedAtMs: number | null;
  engine: SearchEngine;
  sourceType: SourceType;
  credibility: Credibility;
}

export type WebSearchTimeRange = "1h" | "24h" | "7d" | "30d" | "all";

export type SearchProviderId = "tavily" | "bocha";

export interface SearchOptions {
  timeRange?: WebSearchTimeRange;
  maxResults?: number;
  topic?: "general" | "news" | "finance";
  includeDomains?: string[];
  /** Bypass the global SEARCH_PROVIDER setting; used by collection adapters that bind to a specific engine. */
  forceProvider?: SearchProviderId;
}

export interface SearchResult {
  items: NewsFeedItem[];
  answer?: string;
  responseTime: number;
  provider: SearchProviderId;
}

export interface SearchProvider {
  id: SearchProviderId;
  search(query: string, options: SearchOptions): Promise<SearchResult>;
}

// ---------------------------------------------------------------------------
// Source classification helpers
// ---------------------------------------------------------------------------

const OFFICIAL_SOURCE_PATTERNS = [
  /新华社|人民日报|央视|央视新闻|中国新闻网|中国政府网|国务院|工信部|商务部|国家统计局|中国日报|人民网/i,
];
const INDUSTRY_SOURCE_PATTERNS = [
  /36氪|虎嗅|钛媒体|界面|财联社|财新|第一财经|TechCrunch|The Verge|Wired|Bloomberg|Reuters|华尔街见闻/i,
];
const SOCIAL_SOURCE_PATTERNS = [
  /微博|知乎|小红书|抖音|快手|B站|豆瓣|Reddit|X|Twitter|Telegram/i,
];

export function inferSourceType(source: string, url: string): SourceType {
  const text = `${source} ${url}`;
  if (OFFICIAL_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) return "official";
  if (INDUSTRY_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) return "industry";
  if (SOCIAL_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) return "social";
  if (source) return "news";
  return "unknown";
}

export function inferCredibility(sourceType: SourceType): Credibility {
  if (sourceType === "official") return "high";
  if (sourceType === "industry" || sourceType === "news") return "medium";
  return "low";
}

export function parseDate(value: string) {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return { publishedAt: null as string | null, publishedAtMs: null as number | null };
  }
  return {
    publishedAt: new Date(ms).toISOString(),
    publishedAtMs: ms,
  };
}

export const DEFAULT_INCLUDE_DOMAINS = [
  "xinhuanet.com", "people.com.cn", "cctv.com", "chinanews.com",
  "36kr.com", "huxiu.com", "tmtpost.com", "jiemian.com",
  "caixin.com", "yicai.com", "thepaper.cn", "sina.com.cn",
  "weibo.com", "zhihu.com", "bilibili.com", "sohu.com",
  "163.com", "qq.com", "baidu.com", "toutiao.com",
];
