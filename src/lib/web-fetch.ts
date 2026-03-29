// ---------------------------------------------------------------------------
// Shared web fetch utilities
// Extracted from tool-registry.ts for reuse across the codebase.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourceType = "official" | "industry" | "social" | "news" | "unknown";
export type Credibility = "high" | "medium" | "low";

export interface NewsFeedItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  publishedAt: string | null;
  publishedAtMs: number | null;
  engine: "google-news" | "bing-news";
  sourceType: SourceType;
  credibility: Credibility;
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score: number;
  published_date?: string;
}

export interface TavilySearchResponse {
  query: string;
  answer?: string;
  results: TavilySearchResult[];
  response_time: number;
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

// ---------------------------------------------------------------------------
// Tavily Search API
// ---------------------------------------------------------------------------

type WebSearchTimeRange = "1h" | "24h" | "7d" | "30d" | "all";

const DEFAULT_INCLUDE_DOMAINS = [
  "xinhuanet.com", "people.com.cn", "cctv.com", "chinanews.com",
  "36kr.com", "huxiu.com", "tmtpost.com", "jiemian.com",
  "caixin.com", "yicai.com", "thepaper.cn", "sina.com.cn",
  "weibo.com", "zhihu.com", "bilibili.com", "sohu.com",
  "163.com", "qq.com", "baidu.com", "toutiao.com",
];

export async function searchViaTavily(
  query: string,
  options: {
    timeRange?: WebSearchTimeRange;
    maxResults?: number;
    topic?: "general" | "news" | "finance";
    include_domains?: string[];
  }
): Promise<{
  items: NewsFeedItem[];
  answer?: string;
  responseTime: number;
}> {
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
      include_domains: options.include_domains ?? DEFAULT_INCLUDE_DOMAINS,
    };

    if (options.topic) {
      body.topic = options.topic;
    }

    if (options.timeRange && options.timeRange !== "all") {
      const daysMap: Record<string, string> = {
        "1h": "day",
        "24h": "day",
        "7d": "week",
        "30d": "month",
      };
      body.time_range = daysMap[options.timeRange] || "week";
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

    return { items, answer: data.answer, responseTime: data.response_time };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Jina Reader API (deep read)
// ---------------------------------------------------------------------------

export async function fetchViaJinaReader(url: string): Promise<{ title: string; content: string }> {
  const apiKey = process.env.JINA_API_KEY;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Return-Format": "markdown",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Jina Reader returned ${response.status}`);
    }

    const data = (await response.json()) as { data?: { title?: string; content?: string } };
    return {
      title: data.data?.title || "",
      content: data.data?.content || "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Cheerio HTML parsing (fallback)
// ---------------------------------------------------------------------------

export async function fetchViaCheerio(url: string): Promise<{ title: string; content: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 VibeTideBot/1.0",
        Accept: "text/html",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Fetch returned ${response.status}`);
    }

    const html = await response.text();
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);

    // Remove noise elements
    $("script, style, nav, header, footer, aside, iframe, .ad, .advertisement, .sidebar, .comment, .comments").remove();

    const title = $("title").text().trim() ||
      $('meta[property="og:title"]').attr("content") || "";

    // Try article/main first, then fall back to body
    let content = "";
    const selectors = ["article", "main", '[role="main"]', ".post-content", ".article-content", ".entry-content"];
    for (const selector of selectors) {
      const el = $(selector);
      if (el.length > 0) {
        content = el.text().trim();
        break;
      }
    }
    if (!content) {
      content = $("body").text().trim();
    }

    // Clean up whitespace
    content = content.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();

    return { title, content };
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Content truncation
// ---------------------------------------------------------------------------

export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  const truncated = content.slice(0, maxLength);
  const lastParagraph = truncated.lastIndexOf("\n\n");
  if (lastParagraph > maxLength * 0.7) {
    return truncated.slice(0, lastParagraph) + "\n\n[...内容已截断]";
  }
  const lastSentence = truncated.lastIndexOf("。");
  if (lastSentence > maxLength * 0.7) {
    return truncated.slice(0, lastSentence + 1) + "\n\n[...内容已截断]";
  }
  return truncated + "...\n\n[...内容已截断]";
}
