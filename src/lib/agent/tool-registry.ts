import { tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { BUILTIN_SKILLS } from "@/lib/constants";
import { ilike, sql } from "drizzle-orm";
import * as cheerio from "cheerio";
import type { AgentTool } from "./types";

// ---------------------------------------------------------------------------
// Web search helpers
// ---------------------------------------------------------------------------

type WebSearchTimeRange = "1h" | "24h" | "7d" | "30d" | "all";
type SourceType = "official" | "industry" | "social" | "news" | "unknown";
type Credibility = "high" | "medium" | "low";

interface NewsFeedItem {
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

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  official: "央媒/官方",
  industry: "行业媒体",
  social: "社交/社区",
  news: "新闻媒体",
  unknown: "其他",
};

const TIME_RANGE_MS: Record<WebSearchTimeRange, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: Number.POSITIVE_INFINITY,
};

const OFFICIAL_SOURCE_PATTERNS = [
  /新华社|人民日报|央视|央视新闻|中国新闻网|中国政府网|国务院|工信部|商务部|国家统计局|中国日报|人民网/i,
];
const INDUSTRY_SOURCE_PATTERNS = [
  /36氪|虎嗅|钛媒体|界面|财联社|财新|第一财经|TechCrunch|The Verge|Wired|Bloomberg|Reuters|华尔街见闻/i,
];
const SOCIAL_SOURCE_PATTERNS = [
  /微博|知乎|小红书|抖音|快手|B站|豆瓣|Reddit|X|Twitter|Telegram/i,
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value: string) {
  return normalizeWhitespace(decodeHtmlEntities(value).replace(/<[^>]+>/g, " "));
}

function extractXmlValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, "i"));
  return match ? normalizeWhitespace(decodeHtmlEntities(match[1])) : "";
}

function safeUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return "";
  }
}

function parseDate(value: string) {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    return { publishedAt: null as string | null, publishedAtMs: null as number | null };
  }
  return {
    publishedAt: new Date(ms).toISOString(),
    publishedAtMs: ms,
  };
}

function inferSource(title: string, source: string, url: string) {
  const candidate = source || title.split(" - ").at(-1) || url;
  return normalizeWhitespace(candidate);
}

function inferSourceType(source: string, url: string): SourceType {
  const text = `${source} ${url}`;
  if (OFFICIAL_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) return "official";
  if (INDUSTRY_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) return "industry";
  if (SOCIAL_SOURCE_PATTERNS.some((pattern) => pattern.test(text))) return "social";
  if (source) return "news";
  return "unknown";
}

function inferCredibility(sourceType: SourceType): Credibility {
  if (sourceType === "official") return "high";
  if (sourceType === "industry" || sourceType === "news") return "medium";
  return "low";
}

function buildSearchVariants(query: string) {
  return Array.from(
    new Set([
      query,
      query.includes("最新") ? query : `${query} 最新`,
      query.includes("热点") ? query : `${query} 热点`,
    ])
  ).slice(0, 3);
}

function buildGoogleNewsUrl(query: string, timeRange: WebSearchTimeRange) {
  const whenSuffix =
    timeRange === "1h"
      ? " when:1h"
      : timeRange === "24h"
        ? " when:1d"
        : timeRange === "7d"
          ? " when:7d"
          : timeRange === "30d"
            ? " when:30d"
            : "";
  return `https://news.google.com/rss/search?q=${encodeURIComponent(`${query}${whenSuffix}`)}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans`;
}

function buildBingNewsUrl(query: string) {
  return `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=zh-CN`;
}

async function fetchFeed(url: string, engine: NewsFeedItem["engine"]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 VibeTideBot/1.0",
        Accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.9",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${engine} returned ${response.status}`);
    }

    const xml = await response.text();
    return parseRssItems(xml, engine);
  } finally {
    clearTimeout(timeout);
  }
}

function parseRssItems(xml: string, engine: NewsFeedItem["engine"]): NewsFeedItem[] {
  const items = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi));
  return items
    .map((match) => {
      const itemXml = match[0];
      const title = stripHtml(extractXmlValue(itemXml, "title"));
      const rawDescription = extractXmlValue(itemXml, "description");
      const snippet = stripHtml(rawDescription);
      const url = safeUrl(extractXmlValue(itemXml, "link"));
      const source = inferSource(
        title,
        stripHtml(extractXmlValue(itemXml, "source") || extractXmlValue(itemXml, "News:Source")),
        url
      );
      const { publishedAt, publishedAtMs } = parseDate(extractXmlValue(itemXml, "pubDate"));
      const sourceType = inferSourceType(source, url);
      const credibility = inferCredibility(sourceType);

      if (!title || !url) return null;

      return {
        title,
        snippet,
        url,
        source,
        publishedAt,
        publishedAtMs,
        engine,
        sourceType,
        credibility,
      } satisfies NewsFeedItem;
    })
    .filter((item): item is NewsFeedItem => Boolean(item));
}

function filterByTimeRange(items: NewsFeedItem[], timeRange: WebSearchTimeRange) {
  if (timeRange === "all") return items;
  const maxAge = TIME_RANGE_MS[timeRange];
  const now = Date.now();
  return items.filter((item) => {
    if (!item.publishedAtMs) return true;
    return now - item.publishedAtMs <= maxAge;
  });
}

function filterBySourcePreference(items: NewsFeedItem[], sources?: string[]) {
  if (!sources || sources.length === 0) return items;

  const acceptedTypes = new Set<SourceType>();
  for (const source of sources) {
    if (/央媒|官方|government|official/i.test(source)) acceptedTypes.add("official");
    if (/行业|财经|垂媒|industry/i.test(source)) acceptedTypes.add("industry");
    if (/社交|社区|social/i.test(source)) acceptedTypes.add("social");
    if (/新闻|媒体|news/i.test(source)) acceptedTypes.add("news");
  }

  if (acceptedTypes.size === 0) return items;
  return items.filter((item) => acceptedTypes.has(item.sourceType));
}

function dedupeItems(items: NewsFeedItem[]) {
  const map = new Map<string, NewsFeedItem>();
  for (const item of items) {
    const key = `${item.title.toLowerCase()}::${item.source.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    const existingTime = existing.publishedAtMs ?? 0;
    const currentTime = item.publishedAtMs ?? 0;
    if (currentTime > existingTime) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
}

function scoreNewsItem(item: NewsFeedItem, query: string) {
  let score = 0;
  if (item.sourceType === "official") score += 30;
  else if (item.sourceType === "industry") score += 24;
  else if (item.sourceType === "news") score += 18;
  else if (item.sourceType === "social") score += 10;

  const tokens = query
    .split(/[\s,，。！？!?:：;；、/|]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length >= 2);
  const haystack = `${item.title} ${item.snippet}`.toLowerCase();
  for (const token of tokens) {
    if (haystack.includes(token)) score += 8;
  }

  if (item.publishedAtMs) {
    const ageHours = (Date.now() - item.publishedAtMs) / (60 * 60 * 1000);
    score += Math.max(0, 36 - Math.min(ageHours, 36));
  }

  if (item.engine === "google-news") score += 4;
  return score;
}

function rankItems(items: NewsFeedItem[], query: string) {
  return [...items].sort((a, b) => {
    const scoreDiff = scoreNewsItem(b, query) - scoreNewsItem(a, query);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.publishedAtMs ?? 0) - (a.publishedAtMs ?? 0);
  });
}

function createTopicLabel(title: string) {
  const trimmed = title.replace(/\s+-\s+[^-]+$/, "").trim();
  const parts = trimmed
    .split(/[|｜丨:：—–-]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const best = parts.find((part) => part.length >= 4 && part.length <= 28) || trimmed;
  return best.slice(0, 40);
}

function buildHotTopics(items: NewsFeedItem[], limit: number) {
  const topics = new Map<
    string,
    {
      topic: string;
      representativeTitle: string;
      latestPublishedAt: string | null;
      sources: Set<string>;
      url: string;
      sourceType: SourceType;
      mentions: number;
    }
  >();

  for (const item of items.slice(0, 12)) {
    const topic = createTopicLabel(item.title);
    const existing = topics.get(topic);
    if (!existing) {
      topics.set(topic, {
        topic,
        representativeTitle: item.title,
        latestPublishedAt: item.publishedAt,
        sources: new Set([item.source]),
        url: item.url,
        sourceType: item.sourceType,
        mentions: 1,
      });
      continue;
    }

    existing.mentions += 1;
    existing.sources.add(item.source);
    const existingTime = existing.latestPublishedAt ? Date.parse(existing.latestPublishedAt) : 0;
    const currentTime = item.publishedAt ? Date.parse(item.publishedAt) : 0;
    if (currentTime > existingTime) {
      existing.latestPublishedAt = item.publishedAt;
      existing.representativeTitle = item.title;
      existing.url = item.url;
      existing.sourceType = item.sourceType;
    }
  }

  return Array.from(topics.values())
    .sort((a, b) => {
      const mentionDiff = b.mentions - a.mentions;
      if (mentionDiff !== 0) return mentionDiff;
      return (Date.parse(b.latestPublishedAt || "1970-01-01") || 0) -
        (Date.parse(a.latestPublishedAt || "1970-01-01") || 0);
    })
    .slice(0, limit)
    .map((topic) => ({
      topic: topic.topic,
      representativeTitle: topic.representativeTitle,
      latestPublishedAt: topic.latestPublishedAt,
      url: topic.url,
      mentions: topic.mentions,
      sourceType: SOURCE_TYPE_LABELS[topic.sourceType],
      sources: Array.from(topic.sources),
      heatLevel: topic.mentions >= 3 ? "high" : topic.mentions === 2 ? "medium" : "observed",
    }));
}

function buildSearchSummary(results: NewsFeedItem[], hotTopics: ReturnType<typeof buildHotTopics>) {
  if (results.length === 0) {
    return "未检索到符合条件的实时结果，建议放宽时间范围或调整关键词。";
  }

  const topSources = Array.from(new Set(results.slice(0, 5).map((item) => item.source))).join("、");
  const hotTopicPreview = hotTopics.slice(0, 3).map((topic) => topic.topic).join("；");
  return `已聚合 ${results.length} 条最新结果，核心来源包括 ${topSources}。当前高关注话题：${hotTopicPreview || "暂无明显聚类话题"}。`;
}

// ---------------------------------------------------------------------------
// Tavily Search API helpers
// ---------------------------------------------------------------------------

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

async function searchViaTavily(
  query: string,
  options: {
    timeRange?: WebSearchTimeRange;
    maxResults?: number;
    topic?: "general" | "news" | "finance";
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
      include_domains: [
        "xinhuanet.com", "people.com.cn", "cctv.com", "chinanews.com",
        "36kr.com", "huxiu.com", "tmtpost.com", "jiemian.com",
        "caixin.com", "yicai.com", "thepaper.cn", "sina.com.cn",
        "weibo.com", "zhihu.com", "bilibili.com", "sohu.com",
        "163.com", "qq.com", "baidu.com", "toutiao.com",
      ],
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
// Web Deep Read helpers
// ---------------------------------------------------------------------------

async function fetchViaJinaReader(url: string): Promise<{ title: string; content: string }> {
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

async function fetchViaCheerio(url: string): Promise<{ title: string; content: string }> {
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

function truncateContent(content: string, maxLength: number): string {
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

// ---------------------------------------------------------------------------
// Trending Topics helpers
// ---------------------------------------------------------------------------

interface TrendingResponseMapping {
  nodes?: Record<string, string>;
  authMode?: "bearer" | "raw";
}

interface TrendingItem {
  platform: string;
  rank: number;
  title: string;
  heat: number | string;
  url: string;
  category?: string;
}

function parseTrendingMapping(): TrendingResponseMapping | null {
  const raw = process.env.TRENDING_RESPONSE_MAPPING;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TrendingResponseMapping;
  } catch {
    return null;
  }
}

function buildTophubHeaders(): Record<string, string> {
  const apiKey = process.env.TRENDING_API_KEY;
  const mapping = parseTrendingMapping();
  const authMode = mapping?.authMode ?? "raw";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) {
    headers["Authorization"] = authMode === "bearer" ? `Bearer ${apiKey}` : apiKey;
  }
  return headers;
}

/** Fetch /hot — cross-platform trending aggregation (one request, all platforms) */
async function fetchTrendingHot(): Promise<TrendingItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch("https://api.tophubdata.com/hot", {
      headers: buildTophubHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`TopHub /hot returned ${response.status}`);
    }

    const json = (await response.json()) as {
      error: boolean;
      data: {
        title: string;
        url: string;
        domain: string;
        sitename: string;
        views: string;
        time: string;
      }[];
    };

    if (json.error || !Array.isArray(json.data)) return [];

    return json.data.map((item, index) => ({
      platform: item.sitename || item.domain,
      rank: index + 1,
      title: item.title,
      heat: item.views || "",
      url: item.url,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch /nodes/@hashid — single platform trending list */
async function fetchTrendingNode(
  nodeId: string,
  platformName?: string
): Promise<TrendingItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`https://api.tophubdata.com/nodes/${nodeId}`, {
      headers: buildTophubHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`TopHub /nodes/${nodeId} returned ${response.status}`);
    }

    const json = (await response.json()) as {
      error: boolean;
      data: {
        name: string;
        items: { title: string; url: string; rank: number; extra: string; description: string }[];
      };
    };

    if (json.error || !json.data?.items) return [];

    const name = platformName || json.data.name;
    return json.data.items.map((item) => ({
      platform: name,
      rank: item.rank,
      title: item.title,
      heat: item.extra || "",
      url: item.url,
      category: item.description || undefined,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch /search — search across all trending lists */
async function fetchTrendingSearch(query: string): Promise<TrendingItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `https://api.tophubdata.com/search?q=${encodeURIComponent(query)}&p=1`;
    const response = await fetch(url, {
      headers: buildTophubHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`TopHub /search returned ${response.status}`);
    }

    const json = (await response.json()) as {
      error: boolean;
      data: {
        items: { title: string; url: string; extra: string; time: number }[];
      };
    };

    if (json.error || !json.data?.items) return [];

    return json.data.items.map((item, index) => ({
      platform: "全网",
      rank: index + 1,
      title: item.title,
      heat: item.extra || "",
      url: item.url,
    }));
  } finally {
    clearTimeout(timeout);
  }
}

// Platform name → TopHub node hashid mapping
const TOPHUB_DEFAULT_NODES: Record<string, string> = {
  微博热搜: "KqndgxeLl9",
  知乎热榜: "mproPpoq6O",
  百度热点: "Jb0vmloB1G",
  抖音热搜: "K7GdaMgdQy",
  今日头条: "x9ozB4KoXb",
  "36氪热榜": "Q1Vd5Ko85R",
  哔哩哔哩: "74KvxwokxM",
  小红书: "L4MdA5ldxD",
  澎湃热榜: "wWmoO5Rd4E",
  微信热文: "WnBe01o371",
};

const PLATFORM_ALIASES: Record<string, string[]> = {
  微博热搜: ["weibo", "微博"],
  知乎热榜: ["zhihu", "知乎"],
  百度热点: ["baidu", "百度"],
  抖音热搜: ["douyin", "抖音"],
  今日头条: ["toutiao", "头条"],
  "36氪热榜": ["36kr", "36氪"],
  哔哩哔哩: ["bilibili", "b站", "哔哩"],
  小红书: ["xiaohongshu", "小红书", "红书"],
  澎湃热榜: ["thepaper", "澎湃"],
  微信热文: ["weixin", "wechat", "微信"],
};

function resolveNodeIds(platforms?: string[]): Record<string, string> {
  const mapping = parseTrendingMapping();
  const nodes = { ...TOPHUB_DEFAULT_NODES, ...(mapping?.nodes || {}) };

  if (!platforms || platforms.length === 0) return nodes;

  const result: Record<string, string> = {};
  for (const [name, hashid] of Object.entries(nodes)) {
    const aliases = PLATFORM_ALIASES[name] || [name.toLowerCase()];
    if (platforms.some((p) => aliases.some((a) => a.includes(p.toLowerCase()) || p.toLowerCase().includes(a)))) {
      result[name] = hashid;
    }
  }
  return result;
}

async function fetchTrendingFromApi(
  mode: "hot" | "platforms" | "search",
  options: { platforms?: string[]; limit?: number; query?: string }
): Promise<TrendingItem[]> {
  if (!process.env.TRENDING_API_KEY) {
    throw new Error("TRENDING_API_KEY not configured");
  }

  if (mode === "hot") {
    return fetchTrendingHot();
  }

  if (mode === "search" && options.query) {
    return fetchTrendingSearch(options.query);
  }

  // platforms mode: fetch selected platform nodes in parallel
  const nodes = resolveNodeIds(options.platforms);
  const entries = Object.entries(nodes);

  if (entries.length === 0) {
    throw new Error(`未匹配到平台，可用平台: ${Object.keys(TOPHUB_DEFAULT_NODES).join("、")}`);
  }

  const results = await Promise.allSettled(
    entries.map(([name, hashid]) => fetchTrendingNode(hashid, name))
  );

  const allItems: TrendingItem[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      const items = options.limit ? result.value.slice(0, options.limit) : result.value;
      allItems.push(...items);
    }
  }
  return allItems;
}

function buildCrossPlatformTopics(items: TrendingItem[]): {
  title: string;
  platforms: string[];
  totalHeat: number;
  verified: boolean;
}[] {
  const topicMap = new Map<string, {
    title: string;
    platforms: Set<string>;
    totalHeat: number;
  }>();

  for (const item of items) {
    const key = item.title
      .replace(/[#【】\[\]《》「」\s]/g, "")
      .toLowerCase()
      .slice(0, 20);

    const existing = topicMap.get(key);
    if (existing) {
      existing.platforms.add(item.platform);
      existing.totalHeat += typeof item.heat === "number" ? item.heat : 0;
    } else {
      topicMap.set(key, {
        title: item.title,
        platforms: new Set([item.platform]),
        totalHeat: typeof item.heat === "number" ? item.heat : 0,
      });
    }
  }

  return Array.from(topicMap.values())
    .filter((t) => t.platforms.size >= 2)
    .sort((a, b) => b.totalHeat - a.totalHeat)
    .map((t) => ({
      title: t.title,
      platforms: Array.from(t.platforms),
      totalHeat: t.totalHeat,
      verified: false,
    }));
}

// ---------------------------------------------------------------------------
// Tool definitions using Vercel AI SDK format
// ---------------------------------------------------------------------------

function createToolDefinitions(): ToolSet {
  return {
    web_search: tool({
      description: "搜索互联网最新信息并提炼热点话题，返回实时结果、来源与热点聚类",
      inputSchema: z.object({
        query: z.string().describe("搜索关键词或自然语言问题"),
        timeRange: z
          .enum(["1h", "24h", "7d", "30d", "all"])
          .optional()
          .default("24h")
          .describe("时间范围"),
        sources: z.array(z.string()).optional().describe("来源过滤，如央媒/行业媒体/社交/新闻媒体"),
        maxResults: z.number().optional().default(8).describe("最大结果数，默认 8，最大 20"),
        topic: z
          .enum(["general", "news", "finance"])
          .optional()
          .describe("搜索类型（仅 Tavily 通道生效）"),
      }),
      execute: async ({ query, timeRange = "24h", sources, maxResults = 8, topic }) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
          return {
            query: "",
            generatedAt: new Date().toISOString(),
            summary: "查询词为空，无法执行检索。",
            coverage: { totalFetched: 0, returnedCount: 0, sourceCount: 0, timeRange, sourceFilters: sources ?? [] },
            results: [],
            hotTopics: [],
            warnings: ["查询词不能为空"],
          };
        }

        const limitedResults = Math.max(1, Math.min(maxResults, 20));
        const warnings: string[] = [];
        let fetchedItems: NewsFeedItem[] = [];
        let tavilyAnswer: string | undefined;

        // --- Primary channel: Tavily API ---
        if (process.env.TAVILY_API_KEY) {
          try {
            const tavilyResult = await searchViaTavily(trimmedQuery, {
              timeRange,
              maxResults: limitedResults,
              topic,
            });
            fetchedItems = tavilyResult.items;
            tavilyAnswer = tavilyResult.answer;
          } catch (err) {
            warnings.push(`Tavily 通道失败: ${err instanceof Error ? err.message : String(err)}，回退到 RSS`);
          }
        }

        // --- Fallback channel: RSS feeds ---
        if (fetchedItems.length === 0) {
          const searchVariants = buildSearchVariants(trimmedQuery);
          const feedRequests = searchVariants.flatMap((variant) => [
            fetchFeed(buildGoogleNewsUrl(variant, timeRange), "google-news"),
            fetchFeed(buildBingNewsUrl(variant), "bing-news"),
          ]);

          const settled = await Promise.allSettled(feedRequests);
          warnings.push(
            ...settled
              .filter((r): r is PromiseRejectedResult => r.status === "rejected")
              .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
          );
          fetchedItems = settled
            .filter((r): r is PromiseFulfilledResult<NewsFeedItem[]> => r.status === "fulfilled")
            .flatMap((r) => r.value);
        }

        const filteredItems = rankItems(
          filterBySourcePreference(filterByTimeRange(dedupeItems(fetchedItems), timeRange), sources),
          trimmedQuery
        );

        const results = filteredItems.slice(0, limitedResults).map((item) => ({
          title: item.title,
          snippet: item.snippet || item.title,
          url: item.url,
          source: item.source,
          engine: item.engine,
          sourceType: SOURCE_TYPE_LABELS[item.sourceType],
          credibility: item.credibility,
          publishedAt: item.publishedAt,
        }));

        const searchVariants = buildSearchVariants(trimmedQuery);
        const hotTopics = buildHotTopics(filteredItems, Math.min(5, limitedResults));

        return {
          query: trimmedQuery,
          generatedAt: new Date().toISOString(),
          searchVariants,
          summary: tavilyAnswer || buildSearchSummary(filteredItems.slice(0, limitedResults), hotTopics),
          coverage: {
            totalFetched: fetchedItems.length,
            returnedCount: results.length,
            sourceCount: new Set(results.map((item) => item.source)).size,
            timeRange,
            sourceFilters: sources ?? [],
            channel: process.env.TAVILY_API_KEY ? "tavily" : "rss",
          },
          results,
          hotTopics,
          warnings,
        };
      },
    }),
    web_deep_read: tool({
      description: "抓取指定网页的正文内容，用于对搜索结果进行深度阅读分析",
      inputSchema: z.object({
        url: z.string().describe("要深读的网页 URL"),
        maxLength: z.number().optional().default(3000).describe("正文截断字数，默认 3000"),
      }),
      execute: async ({ url: targetUrl, maxLength = 3000 }) => {
        const trimmedUrl = targetUrl.trim();
        try {
          new URL(trimmedUrl);
        } catch {
          return {
            title: "",
            content: "",
            wordCount: 0,
            extractedAt: new Date().toISOString(),
            source: "",
            success: false,
            error: "URL 格式无效",
          };
        }

        const source = new URL(trimmedUrl).hostname.replace(/^www\./, "");
        let title = "";
        let content = "";
        let error: string | undefined;

        // Primary: Jina Reader API
        if (process.env.JINA_API_KEY) {
          try {
            const result = await fetchViaJinaReader(trimmedUrl);
            title = result.title;
            content = result.content;
          } catch (err) {
            error = `Jina Reader 失败: ${err instanceof Error ? err.message : String(err)}`;
          }
        }

        // Fallback: cheerio
        if (!content) {
          try {
            const result = await fetchViaCheerio(trimmedUrl);
            title = title || result.title;
            content = result.content;
            if (error) error += "；已回退到直接抓取";
          } catch (err) {
            return {
              title,
              content: "",
              wordCount: 0,
              extractedAt: new Date().toISOString(),
              source,
              success: false,
              error: error
                ? `${error}；直接抓取也失败: ${err instanceof Error ? err.message : String(err)}`
                : `抓取失败: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }

        const truncatedContent = truncateContent(content, maxLength);

        return {
          title,
          content: truncatedContent,
          wordCount: truncatedContent.length,
          extractedAt: new Date().toISOString(),
          source,
          success: true,
          error,
        };
      },
    }),
    trending_topics: tool({
      description: "聚合多平台实时热榜（微博/知乎/百度/抖音/小红书/36氪等），发现全网热点话题。支持三种模式：hot=全网热点榜中榜、platforms=指定平台热榜、search=全网热榜关键词搜索",
      inputSchema: z.object({
        mode: z
          .enum(["hot", "platforms", "search"])
          .optional()
          .default("hot")
          .describe("模式：hot=全网热点聚合（推荐）、platforms=指定平台热榜、search=全网热榜搜索"),
        platforms: z
          .array(z.string())
          .optional()
          .describe("platforms 模式下指定平台：weibo/zhihu/baidu/douyin/xiaohongshu/36kr/bilibili/toutiao/thepaper/weixin"),
        query: z
          .string()
          .optional()
          .describe("search 模式下的搜索关键词"),
        limit: z
          .number()
          .optional()
          .default(20)
          .describe("每个平台返回条数，默认 20"),
      }),
      execute: async ({ mode = "hot", platforms, query, limit = 20 }) => {
        const warnings: string[] = [];
        let items: TrendingItem[] = [];

        if (!process.env.TRENDING_API_KEY) {
          return {
            fetchedAt: new Date().toISOString(),
            mode,
            platforms: [],
            topics: [],
            crossPlatformTopics: [],
            warnings: ["未配置 TRENDING_API_KEY，无法获取实时热榜数据"],
          };
        }

        try {
          items = await fetchTrendingFromApi(mode, { platforms, limit, query });
        } catch (err) {
          warnings.push(`热榜 API 失败: ${err instanceof Error ? err.message : String(err)}`);
        }

        if (items.length === 0 && warnings.length > 0) {
          return {
            fetchedAt: new Date().toISOString(),
            mode,
            platforms: platforms ?? [],
            topics: [],
            crossPlatformTopics: [],
            warnings,
          };
        }

        const crossPlatformTopics = mode === "hot" ? buildCrossPlatformTopics(items) : [];
        const activePlatforms = Array.from(new Set(items.map((i) => i.platform)));

        return {
          fetchedAt: new Date().toISOString(),
          mode,
          platforms: activePlatforms,
          totalCount: items.length,
          topics: items.slice(0, mode === "hot" ? 50 : limit * Math.max(activePlatforms.length, 1)),
          crossPlatformTopics,
          warnings,
        };
      },
    }),
    content_generate: tool({
      description: "根据大纲和要求生成内容文本",
      inputSchema: z.object({
        outline: z.string().describe("内容大纲"),
        style: z
          .string()
          .optional()
          .default("professional")
          .describe("写作风格"),
        maxLength: z.number().optional().default(2000).describe("最大字数"),
      }),
      execute: async ({ outline, style }) => ({
        content: `[模拟生成内容] 基于大纲「${outline}」，以${style}风格生成的内容。`,
        wordCount: 100,
      }),
    }),
    fact_check: tool({
      description: "对给定文本进行事实核查",
      inputSchema: z.object({
        text: z.string().describe("需要核查的文本"),
        claims: z.array(z.string()).optional().describe("具体需要核查的声明"),
      }),
      execute: async ({ text }) => ({
        overallScore: 85,
        issues: [],
        summary: `[模拟核查] 文本（${text.slice(0, 50)}...）的事实核查结果：整体可信度 85/100。`,
      }),
    }),
    media_search: tool({
      description: "从媒资库中检索素材（图片、视频、音频、文档）",
      inputSchema: z.object({
        keyword: z.string().describe("搜索关键词"),
        type: z
          .enum(["image", "video", "audio", "document"])
          .optional()
          .describe("素材类型过滤"),
        limit: z.number().optional().default(10).describe("返回数量"),
      }),
      execute: async ({ keyword, type, limit }) => {
        const conditions = [ilike(mediaAssets.title, `%${keyword}%`)];
        if (type) {
          conditions.push(sql`${mediaAssets.type} = ${type}` as never);
        }
        const results = await db
          .select({
            id: mediaAssets.id,
            title: mediaAssets.title,
            type: mediaAssets.type,
            description: mediaAssets.description,
            fileUrl: mediaAssets.fileUrl,
            thumbnailUrl: mediaAssets.thumbnailUrl,
            tags: mediaAssets.tags,
            usageCount: mediaAssets.usageCount,
          })
          .from(mediaAssets)
          .where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`)
          .limit(limit || 10);

        return {
          count: results.length,
          assets: results.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            description: r.description || "",
            url: r.fileUrl || "",
            thumbnail: r.thumbnailUrl || "",
            tags: r.tags || [],
          })),
        };
      },
    }),
    data_report: tool({
      description: "生成数据分析报告，汇总渠道传播数据",
      inputSchema: z.object({
        reportType: z
          .enum(["daily", "weekly", "monthly"])
          .describe("报告周期"),
        metrics: z
          .array(z.string())
          .optional()
          .describe("关注的指标（如阅读量、互动率、粉丝增长）"),
      }),
      execute: async ({ reportType, metrics }) => {
        const periodLabels = {
          daily: "日报",
          weekly: "周报",
          monthly: "月报",
        };
        return {
          period: periodLabels[reportType],
          generatedAt: new Date().toISOString(),
          requestedMetrics: metrics || ["阅读量", "互动率", "发布数"],
          summary: `[数据${periodLabels[reportType]}] 已生成${periodLabels[reportType]}数据概览。`,
          note: "详细数据请查看数据分析仪表盘。",
        };
      },
    }),
  };
}

const ALL_TOOLS = createToolDefinitions();
const BUILTIN_SKILL_NAME_TO_SLUG = new Map(BUILTIN_SKILLS.map((skill) => [skill.name, skill.slug]));

// ---------------------------------------------------------------------------
// Resolve skill names to AgentTool descriptors
// ---------------------------------------------------------------------------

export function resolveTools(skillNames: string[]): AgentTool[] {
  return skillNames.map((name) => {
    const normalizedName = BUILTIN_SKILL_NAME_TO_SLUG.get(name) ?? name;
    const impl = ALL_TOOLS[normalizedName];
    if (impl) {
      return {
        name: normalizedName,
        description: impl.description ?? `执行「${name}」`,
        parameters: {},
      };
    }
    return {
      name,
      description: `执行「${name}」技能`,
      parameters: {},
    };
  });
}

// ---------------------------------------------------------------------------
// Plugin skill configuration type
// ---------------------------------------------------------------------------

interface PluginConfig {
  endpoint: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  authType?: "none" | "api_key" | "bearer";
  authKey?: string;
  requestTemplate?: string;
  responseMapping?: Record<string, string>;
  timeoutMs?: number;
}

function createPluginTool(name: string, description: string, config: PluginConfig) {
  return tool({
    description,
    inputSchema: z.object({
      input: z.string().describe("任务输入"),
      parameters: z.record(z.string(), z.unknown()).optional().describe("额外参数"),
    }),
    execute: async ({ input, parameters }) => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        };

        if (config.authType === "bearer" && config.authKey) {
          headers["Authorization"] = `Bearer ${config.authKey}`;
        } else if (config.authType === "api_key" && config.authKey) {
          headers["X-API-Key"] = config.authKey;
        }

        const body = config.requestTemplate
          ? config.requestTemplate
              .replace("{{input}}", input)
              .replace("{{parameters}}", JSON.stringify(parameters || {}))
          : JSON.stringify({ input, parameters });

        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          config.timeoutMs || 30000
        );

        const response = await fetch(config.endpoint, {
          method: config.method || "POST",
          headers,
          body: config.method === "GET" ? undefined : body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          return {
            error: `Plugin API returned ${response.status}: ${response.statusText}`,
            pluginName: name,
          };
        }

        const data = await response.json();
        return { result: data, pluginName: name };
      } catch (err) {
        return {
          error: `Plugin「${name}」执行失败: ${err instanceof Error ? err.message : String(err)}`,
          pluginName: name,
        };
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Convert AgentTools to Vercel AI SDK ToolSet for generateText().
// ---------------------------------------------------------------------------

export function toVercelTools(
  agentTools: AgentTool[],
  pluginConfigs?: Map<string, { description: string; config: PluginConfig }>
): ToolSet {
  const result: ToolSet = {};

  for (const t of agentTools) {
    if (ALL_TOOLS[t.name]) {
      result[t.name] = ALL_TOOLS[t.name];
    } else if (pluginConfigs?.has(t.name)) {
      const plugin = pluginConfigs.get(t.name)!;
      result[t.name] = createPluginTool(t.name, plugin.description, plugin.config);
    } else {
      result[t.name] = tool({
        description: t.description,
        inputSchema: z.object({
          input: z.string().optional().describe("任务输入"),
        }),
        execute: async ({ input }) => ({
          result: `[${t.name}] 已完成处理${input ? `：${input}` : ""}`,
        }),
      });
    }
  }

  return result;
}
