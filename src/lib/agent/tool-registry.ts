import { tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getBuiltinSkillNameToSlug } from "@/lib/skill-loader";
import {
  searchViaTavily,
  fetchViaJinaReader,
  fetchViaCheerio,
  truncateContent,
  inferSourceType,
  inferCredibility,
  parseDate,
  type NewsFeedItem,
  type SourceType,
} from "@/lib/web-fetch";
import { ilike, sql } from "drizzle-orm";
import type { AgentTool } from "./types";
import { decrypt } from "@/lib/crypto";

// ---------------------------------------------------------------------------
// Web search helpers
// ---------------------------------------------------------------------------

type WebSearchTimeRange = "1h" | "24h" | "7d" | "30d" | "all";

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

function inferSource(title: string, source: string, url: string) {
  const candidate = source || title.split(" - ").at(-1) || url;
  return normalizeWhitespace(candidate);
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

function buildGoogleNewsUrl(
  query: string,
  timeRange: WebSearchTimeRange | undefined,
) {
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

function filterByTimeRange(
  items: NewsFeedItem[],
  timeRange: WebSearchTimeRange | undefined,
) {
  // 调用方未指定 timeRange → 不按时间过滤（由 Tavily 的相关性排序兜底）。
  // 由用户在步骤参数里显式控制，不在这里写死默认值。
  if (!timeRange || timeRange === "all") return items;
  const maxAge = TIME_RANGE_MS[timeRange];
  const now = Date.now();
  // 严格窗口（1h / 24h）里，没有可解析的发布日期必须剔除 —— 不然就会出现
  // 下面这个经典翻车：
  //   用户搜 "CCBN"（中文垂直话题），Tavily 的 time_range=day 过滤并不严
  //   格，会把 2024 年旧文章以"相关度高"为由塞进返回；中文站点 meta 日期
  //   又解析不出来（publishedAtMs=null），原来的 `return true` 让它们一路
  //   通关。LLM 拿到这些"日期不明"的旧条目当作 24h 内新闻产出，就报出了
  //   "3 月 20 日"（其实是 2024-03-20）这种过期日期。
  //
  // 宽窗口（7d / 30d）仍允许无日期条目：补背景资料是主要用途，日期权重低。
  const strict = timeRange === "1h" || timeRange === "24h";
  return items.filter((item) => {
    if (!item.publishedAtMs) return !strict;
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
// Trending Topics helpers — extracted to @/lib/trending-api for shared use
// ---------------------------------------------------------------------------

import {
  fetchTrendingFromApi,
  buildCrossPlatformTopics,
  type TrendingItem,
} from "@/lib/trending-api";

// ---------------------------------------------------------------------------
// Tool definitions using Vercel AI SDK format
// ---------------------------------------------------------------------------

function createToolDefinitions(): ToolSet {
  return {
    web_search: tool({
      description:
        "搜索互联网最新信息并提炼热点话题。timeRange 由调用方按语义显式指定：" +
        "覆盖'最近一周'/多天研究 → '7d'；覆盖'最近一月'/'本月'/具体月份 → '30d'；" +
        "只要今日突发 → '24h'；不关心时效 → 省略或 'all'。**不在此处写死默认值**，" +
        "以免对长周期话题（垂直展会、年度盘点等）误用 24h 窗口漏查。",
      inputSchema: z.object({
        query: z.string().describe("搜索关键词或自然语言问题"),
        timeRange: z
          .enum(["1h", "24h", "7d", "30d", "all"])
          .optional()
          .describe(
            "相对当前日期的时间窗。省略时不按时间过滤（Tavily 也不传 time_range）。" +
              "周报/特稿类必须显式设 7d 或 30d。",
          ),
        sources: z.array(z.string()).optional().describe("来源过滤，如央媒/行业媒体/社交/新闻媒体"),
        maxResults: z.number().optional().default(8).describe("最大结果数，默认 8，最大 20"),
        topic: z
          .enum(["general", "news", "finance"])
          .optional()
          .describe("搜索类型（仅 Tavily 通道生效）"),
      }),
      execute: async ({ query, timeRange, sources, maxResults = 8, topic }) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
          return {
            query: "",
            generatedAt: new Date().toISOString(),
            summary: "查询词为空，无法执行检索。",
            coverage: {
              totalFetched: 0,
              returnedCount: 0,
              sourceCount: 0,
              timeRange: timeRange ?? "unset",
              sourceFilters: sources ?? [],
            },
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
    // ────────────────────────────────────────────────────────────────
    // 新闻聚合 / 趋势监控 / 社交舆情 / 热度评分
    //
    // 这 4 个工具是"真实数据检索类"：LLM 无法凭空伪造外部世界数据（新闻
    // 条目、平台热榜、报道量），必须调真 API。此前它们只在 resolveTools
    // 兜底里给了占位返回，LLM 按 SKILL.md 模板补数据就会出"04-23 10:30
    // 财政部预算报告"这种未来时间幻觉。本轮把它们升级成真工具。
    //
    // 实现策略：复用已有 searchViaTavily + fetchTrendingFromApi 通道，
    // 在外层包一层 SKILL.md 期望的输出结构。
    // ────────────────────────────────────────────────────────────────
    news_aggregation: tool({
      description:
        "按关键词 + 时间窗聚合多源新闻（央媒、财经、门户、社交），返回结构化列表（含标题/来源/URL/发布时间/来源类型），供下游 fact_check / content_generate 使用。内部复用 Tavily 通道，不用 LLM 生编。",
      inputSchema: z.object({
        query: z.string().describe("聚合的话题关键词"),
        maxResults: z.number().optional().default(10),
        timeRange: z
          .enum(["1h", "24h", "7d", "30d", "all"])
          .optional()
          .describe("时间窗。突发今日 24h / 本周 7d / 本月 30d / 长周期不设"),
        topic: z.enum(["general", "news", "finance"]).optional().default("news"),
      }),
      execute: async ({ query, maxResults = 10, timeRange, topic = "news" }) => {
        if (!process.env.TAVILY_API_KEY) {
          return {
            query,
            generatedAt: new Date().toISOString(),
            results: [],
            warnings: ["未配置 TAVILY_API_KEY，无法聚合新闻"],
          };
        }
        const tavily = await searchViaTavily(query.trim(), {
          timeRange,
          maxResults: Math.min(maxResults, 20),
          topic,
        });
        // 字段命名沿用 web_search 的 `results` —— 下游 mission-executor
        // 统一按 `results` 检测 0 / 稀疏结果并注入强约束警示。
        const results = tavily.items.map((it) => ({
          title: it.title,
          source: it.source,
          sourceType: SOURCE_TYPE_LABELS[it.sourceType],
          credibility: it.credibility,
          url: it.url,
          publishedAt: it.publishedAt,
          snippet: it.snippet,
        }));
        return {
          query,
          generatedAt: new Date().toISOString(),
          timeRange: timeRange ?? "unset",
          totalFetched: tavily.items.length,
          results,
          summary: tavily.answer ?? null,
          warnings: results.length === 0 ? ["Tavily 未命中任何条目，建议放宽 timeRange 或换关键词"] : [],
        };
      },
    }),
    trend_monitor: tool({
      description:
        "监控话题/关键词的实时趋势：调 Tavily 看近期报道走向，调多平台热榜 API 看是否上榜。返回 {搜索结果, 上榜平台, 讨论热度}。",
      inputSchema: z.object({
        query: z.string().describe("监控关键词"),
        timeRange: z
          .enum(["1h", "24h", "7d", "30d"])
          .optional()
          .default("24h")
          .describe("监控时间窗，默认 24h"),
      }),
      execute: async ({ query, timeRange = "24h" }) => {
        const warnings: string[] = [];
        const q = query.trim();

        // 并行：Tavily 新闻 + 多平台热榜搜索
        const [tavilyRes, trendingRes] = await Promise.allSettled([
          process.env.TAVILY_API_KEY
            ? searchViaTavily(q, { timeRange, maxResults: 8, topic: "news" })
            : Promise.reject(new Error("TAVILY_API_KEY 未配置")),
          process.env.TRENDING_API_KEY
            ? fetchTrendingFromApi("search", { query: q, limit: 20 })
            : Promise.reject(new Error("TRENDING_API_KEY 未配置")),
        ]);

        const newsItems =
          tavilyRes.status === "fulfilled"
            ? tavilyRes.value.items.slice(0, 8).map((it) => ({
                title: it.title,
                source: it.source,
                url: it.url,
                publishedAt: it.publishedAt,
              }))
            : [];
        if (tavilyRes.status === "rejected") {
          warnings.push(`Tavily: ${tavilyRes.reason instanceof Error ? tavilyRes.reason.message : String(tavilyRes.reason)}`);
        }

        const trendingItems =
          trendingRes.status === "fulfilled"
            ? trendingRes.value.map((t) => ({
                platform: t.platform,
                title: t.title,
                rank: t.rank,
                heat: t.heat,
              }))
            : [];
        if (trendingRes.status === "rejected") {
          warnings.push(`热榜: ${trendingRes.reason instanceof Error ? trendingRes.reason.message : String(trendingRes.reason)}`);
        }

        return {
          query: q,
          generatedAt: new Date().toISOString(),
          timeRange,
          newsItems,
          onPlatforms: Array.from(new Set(trendingItems.map((t) => t.platform))),
          trendingItems,
          signals: {
            newsCount: newsItems.length,
            platformCount: new Set(trendingItems.map((t) => t.platform)).size,
            hasMomentum: newsItems.length >= 3 || trendingItems.length >= 5,
          },
          warnings,
        };
      },
    }),
    social_listening: tool({
      description:
        "监测话题在社交平台（微博/知乎/小红书/B站/抖音）的讨论热度和关联条目。返回各平台命中的讨论列表。",
      inputSchema: z.object({
        query: z.string().describe("监测关键词"),
        platforms: z
          .array(z.string())
          .optional()
          .describe("指定平台，默认 weibo/zhihu/xiaohongshu/bilibili/douyin"),
        limit: z.number().optional().default(10).describe("每平台条数"),
      }),
      execute: async ({ query, platforms, limit = 10 }) => {
        if (!process.env.TRENDING_API_KEY) {
          return {
            query,
            generatedAt: new Date().toISOString(),
            items: [],
            warnings: ["未配置 TRENDING_API_KEY"],
          };
        }
        const targetPlatforms = platforms ?? [
          "weibo",
          "zhihu",
          "xiaohongshu",
          "bilibili",
          "douyin",
        ];
        try {
          const items = await fetchTrendingFromApi("search", {
            query: query.trim(),
            platforms: targetPlatforms,
            limit,
          });
          const byPlatform = new Map<string, typeof items>();
          for (const item of items) {
            const list = byPlatform.get(item.platform) ?? [];
            list.push(item);
            byPlatform.set(item.platform, list);
          }
          return {
            query,
            generatedAt: new Date().toISOString(),
            platforms: Array.from(byPlatform.keys()),
            totalCount: items.length,
            byPlatform: Object.fromEntries(
              Array.from(byPlatform.entries()).map(([p, list]) => [
                p,
                list.slice(0, limit).map((it) => ({
                  title: it.title,
                  rank: it.rank,
                  heat: it.heat,
                  url: it.url,
                })),
              ]),
            ),
            warnings: items.length === 0 ? ["该关键词在指定平台无命中"] : [],
          };
        } catch (err) {
          return {
            query,
            generatedAt: new Date().toISOString(),
            items: [],
            warnings: [`热榜 API 调用失败: ${err instanceof Error ? err.message : String(err)}`],
          };
        }
      },
    }),
    heat_scoring: tool({
      description:
        "基于真实报道量 + 社交讨论 + 跨平台覆盖度打 0-100 热度分并给出 S/A/B/C 等级。不用 LLM 估分，按确定性公式算。",
      inputSchema: z.object({
        query: z.string().describe("评分话题"),
        timeRange: z
          .enum(["1h", "24h", "7d", "30d"])
          .optional()
          .default("24h"),
      }),
      execute: async ({ query, timeRange = "24h" }) => {
        const q = query.trim();
        const warnings: string[] = [];

        const [newsRes, trendingRes] = await Promise.allSettled([
          process.env.TAVILY_API_KEY
            ? searchViaTavily(q, { timeRange, maxResults: 20, topic: "news" })
            : Promise.reject(new Error("TAVILY_API_KEY 未配置")),
          process.env.TRENDING_API_KEY
            ? fetchTrendingFromApi("search", { query: q, limit: 30 })
            : Promise.reject(new Error("TRENDING_API_KEY 未配置")),
        ]);

        const newsItems = newsRes.status === "fulfilled" ? newsRes.value.items : [];
        if (newsRes.status === "rejected") {
          warnings.push(`Tavily: ${newsRes.reason instanceof Error ? newsRes.reason.message : String(newsRes.reason)}`);
        }
        const trendingItems = trendingRes.status === "fulfilled" ? trendingRes.value : [];
        if (trendingRes.status === "rejected") {
          warnings.push(`热榜: ${trendingRes.reason instanceof Error ? trendingRes.reason.message : String(trendingRes.reason)}`);
        }

        // 四维量化：媒体关注度 / 社交讨论 / 跨平台覆盖 / 来源可信度
        const mediaScore = Math.min(100, newsItems.length * 8); // 12+ 条满分
        const socialScore = Math.min(100, trendingItems.length * 5); // 20+ 条满分
        const platformCount = new Set(trendingItems.map((t) => t.platform)).size;
        const crossPlatformScore =
          platformCount >= 5 ? 100 : platformCount >= 3 ? 75 : platformCount * 25;
        const officialCount = newsItems.filter((it) => it.sourceType === "official").length;
        const credibilityScore = Math.min(100, officialCount * 25);

        const score = Math.round(
          mediaScore * 0.3 +
            socialScore * 0.25 +
            crossPlatformScore * 0.2 +
            credibilityScore * 0.25,
        );
        const grade = score >= 90 ? "S" : score >= 70 ? "A" : score >= 50 ? "B" : "C";

        return {
          query: q,
          generatedAt: new Date().toISOString(),
          timeRange,
          score,
          grade,
          dimensions: {
            media: mediaScore,
            social: socialScore,
            crossPlatform: crossPlatformScore,
            credibility: credibilityScore,
          },
          evidence: {
            newsCount: newsItems.length,
            trendingCount: trendingItems.length,
            platformCount,
            officialSourceCount: officialCount,
            sampleNews: newsItems.slice(0, 3).map((it) => ({
              title: it.title,
              source: it.source,
              url: it.url,
              publishedAt: it.publishedAt,
            })),
            samplePlatforms: Array.from(new Set(trendingItems.map((t) => t.platform))).slice(0, 5),
          },
          confidence:
            newsItems.length + trendingItems.length >= 5
              ? "high"
              : newsItems.length + trendingItems.length >= 2
                ? "medium"
                : "low",
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
          .describe("写作风格：professional/casual/news/academic"),
        maxLength: z.number().optional().default(2000).describe("最大字数"),
      }),
      execute: async ({ outline, style, maxLength }) => {
        try {
          const { generateText: gen } = await import("ai");
          const { getLanguageModel, resolveModelConfig } = await import("./model-router");
          const cfg = resolveModelConfig(["content_gen"], { temperature: 0.7, maxTokens: Math.min(maxLength * 2, 8192) });
          const model = getLanguageModel(cfg);
          const { text, usage } = await gen({
            model,
            prompt: `你是一名资深内容创作者。请根据以下大纲，以「${style}」风格撰写一篇内容。\n\n要求：\n- 字数控制在 ${maxLength} 字以内\n- 结构清晰，逻辑连贯\n- 语言专业且易读\n\n大纲：\n${outline}\n\n请直接输出正文内容，不要包含标题和前言。`,
          });
          return { content: text, wordCount: text.length, tokensUsed: usage?.totalTokens ?? 0 };
        } catch (e) {
          return { content: `[生成失败] ${e instanceof Error ? e.message : "未知错误"}`, wordCount: 0, tokensUsed: 0 };
        }
      },
    }),
    fact_check: tool({
      description: "对给定文本进行事实核查，检查事实准确性和逻辑一致性",
      inputSchema: z.object({
        text: z.string().describe("需要核查的文本"),
        claims: z.array(z.string()).optional().describe("具体需要核查的声明"),
      }),
      execute: async ({ text, claims }) => {
        try {
          const { generateText: gen } = await import("ai");
          const { getLanguageModel, resolveModelConfig } = await import("./model-router");
          const cfg = resolveModelConfig(["quality_review"], { temperature: 0.2, maxTokens: 4096 });
          const model = getLanguageModel(cfg);
          const claimsList = claims?.length ? `\n\n需要重点核查的声明：\n${claims.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : "";
          const { text: result } = await gen({
            model,
            prompt: `你是一名专业事实核查编辑。请对以下文本进行事实核查。${claimsList}\n\n文本内容：\n${text.slice(0, 4000)}\n\n请以 JSON 格式输出核查结果：\n{"overallScore": 0-100分, "issues": [{"claim": "有问题的表述", "issue": "问题说明", "severity": "high/medium/low"}], "summary": "总结"}\n\n只输出 JSON，不要输出其他内容。`,
          });
          try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
          } catch { /* fallthrough */ }
          return { overallScore: 70, issues: [], summary: result.slice(0, 500) };
        } catch (e) {
          return { overallScore: 0, issues: [{ claim: "核查失败", issue: e instanceof Error ? e.message : "未知错误", severity: "high" }], summary: "事实核查服务异常" };
        }
      },
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
    cms_publish: tool({
      description:
        "把一篇稿件真实入库到华栖云 CMS。**appId / catalogId 已硬编码为 " +
        "1768 / 10210（演示环境指定）**，不依赖 app_channels 映射表。流程：" +
        "1) 新建 articles 行（status=approved）；" +
        "2) 直接构造 MapperContext（硬编码 appId/catalogId/siteId）并调 " +
        "saveArticle 走 /web/article/save 真实接口；" +
        "3) 返回 CMS 侧 articleId / publishedUrl / previewUrl。" +
        "前置要求：env 里 CMS_HOST / CMS_LOGIN_CMC_ID / CMS_LOGIN_CMC_TID / " +
        "CMS_TENANT_ID + VIBETIDE_CMS_PUBLISH_ENABLED=true。",
      inputSchema: z.object({
        title: z.string().describe("稿件标题"),
        body: z
          .string()
          .describe("稿件正文（纯文本/Markdown，mapper 会转成 CMS content blocks）"),
        summary: z.string().optional().describe("摘要（50-120 字）"),
        authorName: z
          .string()
          .optional()
          .describe("作者，默认 'AI 编辑部'"),
        coverImageUrl: z.string().optional().describe("封面图 URL"),
        tags: z.array(z.string()).optional().describe("标签数组"),
        // 下面两个由执行器注入，用户在"参数配置"里不需要填。
        organizationId: z
          .string()
          .optional()
          .describe("组织 ID（由 workflow 执行器自动注入）"),
        operatorId: z
          .string()
          .optional()
          .describe("操作者 ID（由 workflow 执行器自动注入）"),
      }),
      execute: async ({
        title,
        body,
        summary,
        authorName,
        coverImageUrl,
        tags,
        organizationId,
        operatorId,
      }) => {
        // 硬编码的 siteId/appId/catalogId 已经在 article-mapper/index.ts 的
        // loadMapperContext 里写死（81/1768/10210），publishArticleToCms 会自动读到。
        // 这里改回走它的完整 9 步流程（feature flag → load article → 状态校验 →
        // load ctx → 幂等检查 → mapping → cms_publications 审计 → saveArticle →
        // 触发 cms/publication.submitted 轮询事件），跟 SKILL.md Workflow
        // Checklist 对齐。
        if (!organizationId) {
          return {
            success: false,
            error: {
              code: "missing_context",
              message:
                "cms_publish 需要 organizationId —— workflow 执行器未注入。",
              stage: "config" as const,
            },
          };
        }

        // 1. 先建 articles 行（status=approved），过 publishArticleToCms 的状态白名单
        const { db } = await import("@/db");
        const { articles } = await import("@/db/schema/articles");
        // articles 表没有 coverImageUrl / authorName 字段（DAL 层的 Article 接口里才有，
        // 原因是封面/作者通过 article_assets / content.headline 间接关联）。
        // 这里只写入 DB 真实列；封面和作者通过 publishArticleToCms 内部映射时走
        // MapperContext 的 coverImageDefault / author 兜底即可。
        const [created] = await db
          .insert(articles)
          .values({
            organizationId,
            title,
            body,
            summary: summary ?? null,
            status: "approved",
            tags: tags ?? [],
            mediaType: "article",
            publishedAt: new Date(),
          })
          .returning({ id: articles.id });
        void coverImageUrl; // 兜底值走 ctx.coverImageDefault（由 loadMapperContext 读 env 得到）
        void authorName; // 兜底值走 ctx.author（在 loadMapperContext 里默认"智媒编辑部"）
        if (!created?.id) {
          return {
            success: false,
            error: {
              code: "article_create_failed",
              message: "创建 articles 行失败",
              stage: "config" as const,
            },
          };
        }

        // 2. 调 publishArticleToCms 完整走 9 步（含 cms_publications 审计 +
        //    Inngest 轮询事件）。feature flag / config 校验都由它内部做，
        //    siteId/appId/catalogId 由 loadMapperContext 读硬编码常量得到。
        const { publishArticleToCms } = await import("@/lib/cms");
        try {
          const pubResult = await publishArticleToCms({
            articleId: created.id,
            operatorId: operatorId ?? "workflow_system",
            triggerSource: "workflow",
            allowUpdate: true,
          });
          return {
            success: pubResult.success,
            articleId: created.id,
            publicationId: pubResult.publicationId,
            cmsArticleId: pubResult.cmsArticleId,
            cmsState: pubResult.cmsState,
            publishedUrl: pubResult.publishedUrl,
            previewUrl: pubResult.previewUrl,
            timings: pubResult.timings,
            meta: {
              title,
              // 硬编码值来自 article-mapper/index.ts 的 HARDCODED_* 常量
              appId: 1768,
              catalogId: 10210,
              siteId: 81,
              authorName: authorName ?? "AI 编辑部",
            },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          let stage = "unknown";
          if (err && typeof err === "object" && "name" in err) {
            const name = String((err as { name?: string }).name || "");
            if (name.includes("Auth")) stage = "auth";
            else if (name.includes("Business")) stage = "cms_business";
            else if (name.includes("Network")) stage = "network";
            else if (name.includes("Config")) stage = "config";
            else if (name.includes("Schema")) stage = "mapping";
          }
          return {
            success: false,
            articleId: created.id,
            error: { code: `cms_${stage}`, message, stage },
            meta: {
              appId: 1768,
              catalogId: 10210,
              siteId: 81,
            },
          };
        }
      },
    }),
  };
}

const ALL_TOOLS = createToolDefinitions();
const BUILTIN_SKILL_NAME_TO_SLUG = getBuiltinSkillNameToSlug();

/**
 * 这个 skill slug 是否对应 ALL_TOOLS 里已注册的真实工具实现？
 * 测试运行 / 预执行路径用它判断"这步骤能不能真调"——能真调就不用 LLM 模拟，
 * 从而保证测试输出跟实际执行输出一致。
 */
export function isToolRegistered(toolName: string): boolean {
  return !!ALL_TOOLS[toolName] && typeof ALL_TOOLS[toolName].execute === "function";
}

// ---------------------------------------------------------------------------
// Tool parameter introspection (for step-config UI)
//
// 工作流步骤编辑器里的"参数配置"需要让用户从该步骤对应工具的真实参数列表
// 里挑选，而不是手写 `query` / `maxResults` 这些字段名 —— 用户根本不知道该
// 工具支持什么参数。这里用 zod v4 的 toJSONSchema 从已注册的 ToolSet 里反
// 推出参数 schema，供 UI 消费。
// ---------------------------------------------------------------------------

export interface ToolParamSpec {
  name: string;
  description?: string;
  required: boolean;
  type: string; // "string" / "number" / "boolean" / "enum" / "array" / "unknown"
  enumValues?: readonly string[];
  defaultValue?: unknown;
}

/**
 * 返回 ALL_TOOLS 里所有工具的参数 spec 映射（skillSlug → specs）。供工作流
 * 编辑器的 server 页面预计算后透传给客户端组件，避免客户端直接 import 这个
 * 文件（会拖进 db / drizzle 等 server-only 依赖）。
 */
export function getAllToolParamSpecs(): Record<string, ToolParamSpec[]> {
  const out: Record<string, ToolParamSpec[]> = {};
  for (const slug of Object.keys(ALL_TOOLS)) {
    const specs = getToolParamSpecs(slug);
    if (specs.length > 0) out[slug] = specs;
  }
  return out;
}

/**
 * 查询某工具（按 skillSlug）的参数清单。参数来自工具定义里的 zod inputSchema，
 * 靠 zod v4 的 `z.toJSONSchema` 转成 JSON Schema 再摘字段。
 * 若工具没注册、schema 结构异常、或 toJSONSchema 失败，返回空数组 —— 调用方
 * 应该在 UI 里回退到"手输参数名"。
 */
export function getToolParamSpecs(toolName: string): ToolParamSpec[] {
  const t = ALL_TOOLS[toolName];
  if (!t) return [];
  type ToolWithSchema = { inputSchema?: unknown };
  const schema = (t as unknown as ToolWithSchema).inputSchema;
  if (!schema || typeof schema !== "object") return [];

  try {
    // z.toJSONSchema 是 zod v4 的稳定 API（v3 没有）。项目已升到 zod 4.3+。
    // 参考：https://zod.dev/json-schema
    const json = z.toJSONSchema(schema as z.ZodType) as Record<string, unknown>;
    const properties = json.properties;
    if (!properties || typeof properties !== "object") return [];
    const required = new Set(
      Array.isArray(json.required) ? (json.required as string[]) : [],
    );
    return Object.entries(properties as Record<string, Record<string, unknown>>).map(
      ([name, p]) => {
        const enumVals = Array.isArray(p.enum) ? (p.enum as string[]) : undefined;
        let resolvedType: string;
        if (enumVals) {
          resolvedType = "enum";
        } else if (typeof p.type === "string") {
          resolvedType = p.type;
        } else {
          resolvedType = "unknown";
        }
        return {
          name,
          description: typeof p.description === "string" ? p.description : undefined,
          required: required.has(name),
          type: resolvedType,
          enumValues: enumVals,
          defaultValue: p.default,
        };
      },
    );
  } catch (err) {
    console.warn(`[tool-registry] getToolParamSpecs(${toolName}) failed:`, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// invokeToolDirectly —— Server-side direct tool invocation
//
// 为什么要这个接口：某些步骤（比如 web_search）哪怕工具可用，LLM 仍会绕开
// 工具按 SKILL.md 的输出模板空转出伪造数据（观察到的实际事故：输入 "CCBN"
// 产出虚构的"暴雨红色预警"、"浦东机场延误"新闻）。当步骤在编辑器里显式
// 绑定了参数（step.config.parameters），我们直接 server 端调工具，把真实
// 结果喂给 LLM —— 这样 LLM 无法伪造，它看到的只能是真数据。
//
// 调用方（mission-executor）负责：
//   1. 基于 mission.inputParams 渲染好参数值
//   2. 把字符串值按 tool schema 做最基础的类型转换（数字/布尔）
//   3. 调本函数，拿到 { ok, result, error }
//   4. 序列化 result 作为【前置工具结果】注入到 LLM userInstructions
// ---------------------------------------------------------------------------
export async function invokeToolDirectly(
  toolName: string,
  rawParams: Record<string, unknown>,
  /**
   * 调用方注入的上下文 —— 用户在"参数配置"里不需要填的字段，由工作流
   * 执行器（mission-executor / test-run 路由）从请求 / mission 带过来。
   * 目前主要用于需要 orgId 才能跑的工具（cms_publish / media_search 等
   * 多租户资源写入场景）。未被对应工具消费的字段会被 zod schema 忽略。
   */
  context?: {
    organizationId?: string;
    operatorId?: string;
  },
): Promise<
  | { ok: true; toolName: string; params: Record<string, unknown>; result: unknown }
  | { ok: false; toolName: string; params: Record<string, unknown>; error: string }
> {
  const t = ALL_TOOLS[toolName];
  if (!t) {
    return {
      ok: false,
      toolName,
      params: rawParams,
      error: `工具 \`${toolName}\` 未在 ALL_TOOLS 中注册`,
    };
  }
  if (typeof t.execute !== "function") {
    return {
      ok: false,
      toolName,
      params: rawParams,
      error: `工具 \`${toolName}\` 未提供 execute 实现`,
    };
  }

  // Best-effort 类型强转：UI 里所有 value 都是字符串，schema 可能期望 number / boolean / array。
  // 走 zod inputSchema 解析前先做宽松映射。
  // 注入上下文：只合并用户未显式提供的字段，避免盖掉用户绑定值。
  const rawWithContext: Record<string, unknown> = { ...rawParams };
  if (context?.organizationId && rawWithContext.organizationId === undefined) {
    rawWithContext.organizationId = context.organizationId;
  }
  if (context?.operatorId && rawWithContext.operatorId === undefined) {
    rawWithContext.operatorId = context.operatorId;
  }
  const coerced: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawWithContext)) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed === "") continue; // 空串视为未提供该参数
      if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
        // 纯数字字符串 → number
        coerced[k] = Number(trimmed);
        continue;
      }
      if (trimmed === "true" || trimmed === "false") {
        coerced[k] = trimmed === "true";
        continue;
      }
      coerced[k] = trimmed;
    } else {
      coerced[k] = v;
    }
  }

  // 通过 tool 的 inputSchema 做最终校验（若定义了）。失败就带着 coerced 原样给 execute。
  type ToolWithSchema = {
    execute?: (
      input: unknown,
      opts: { toolCallId: string; messages: unknown[] },
    ) => unknown;
    inputSchema?: { parse?: (input: unknown) => unknown };
  };
  const tw = t as unknown as ToolWithSchema;
  let parsedInput: unknown = coerced;
  if (tw.inputSchema?.parse) {
    try {
      parsedInput = tw.inputSchema.parse(coerced);
    } catch (err) {
      return {
        ok: false,
        toolName,
        params: coerced,
        error: `参数校验失败：${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  try {
    const result = await (tw.execute!)(parsedInput, {
      toolCallId: `prefetch-${Date.now()}`,
      messages: [],
    });
    return { ok: true, toolName, params: parsedInput as Record<string, unknown>, result };
  } catch (err) {
    return {
      ok: false,
      toolName,
      params: parsedInput as Record<string, unknown>,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

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
    // Sanitize name for API compatibility (must match ^[a-zA-Z0-9_-]+$)
    const safeName = normalizedName.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "unknown_tool";
    return {
      name: safeName,
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
          headers["Authorization"] = `Bearer ${decrypt(config.authKey)}`;
        } else if (config.authType === "api_key" && config.authKey) {
          headers["X-API-Key"] = decrypt(config.authKey);
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

// ---------------------------------------------------------------------------
// Mission collaboration tools (injected during mission execution)
// ---------------------------------------------------------------------------

export function createMissionTools(context: {
  missionId: string;
  employeeId: string;
  employeeSlug: string;
  isLeader: boolean;
}) {
  const tools: ToolSet = {};

  // All team members can send messages
  tools["send_message"] = tool({
    description: "给团队中的其他同事发送消息，讨论问题或协调工作",
    inputSchema: z.object({
      toEmployeeSlug: z.string().describe("接收者的员工slug标识"),
      content: z.string().describe("消息内容"),
    }),
    execute: async ({ toEmployeeSlug, content }) => {
      const { db: _db } = await import("@/db");
      const { missionMessages, aiEmployees: _emp } = await import("@/db/schema");
      const { eq: _eq } = await import("drizzle-orm");

      const recipient = await _db.query.aiEmployees.findFirst({
        where: _eq(_emp.slug, toEmployeeSlug),
      });
      if (!recipient) return { error: `未找到员工：${toEmployeeSlug}` };

      await _db.insert(missionMessages).values({
        missionId: context.missionId,
        fromEmployeeId: context.employeeId,
        toEmployeeId: recipient.id,
        messageType: "question",
        content,
      });
      return { sent: true, to: toEmployeeSlug };
    },
  });

  // All team members can read their messages
  tools["read_messages"] = tool({
    description: "查看团队成员发给自己的消息",
    inputSchema: z.object({}),
    execute: async () => {
      const { db: _db } = await import("@/db");
      const { missionMessages: _mm } = await import("@/db/schema");
      const { eq: _eq, and: _and, asc: _asc } = await import("drizzle-orm");

      const msgs = await _db
        .select()
        .from(_mm)
        .where(
          _and(
            _eq(_mm.missionId, context.missionId),
            _eq(_mm.toEmployeeId, context.employeeId)
          )
        )
        .orderBy(_asc(_mm.createdAt))
        .limit(20);

      return {
        messages: msgs.map((m) => ({
          from: m.fromEmployeeId,
          type: m.messageType,
          content: m.content,
          at: m.createdAt.toISOString(),
        })),
      };
    },
  });

  // Leader-only tools
  if (context.isLeader) {
    tools["create_task"] = tool({
      description: "创建一个新任务到共享任务板",
      inputSchema: z.object({
        title: z.string().describe("任务名称"),
        description: z.string().describe("任务详细描述"),
        expectedOutput: z.string().optional().describe("期望输出描述"),
        assignedEmployeeSlug: z.string().describe("分配给哪个员工（slug）"),
        dependencyTitles: z.array(z.string()).default([]).describe("依赖的任务标题列表"),
        priority: z.number().default(0).describe("优先级，越大越优先"),
      }),
      execute: async ({ title, description, expectedOutput, assignedEmployeeSlug, dependencyTitles, priority }) => {
        const { db: _db } = await import("@/db");
        const { missionTasks: _mt, aiEmployees: _emp } = await import("@/db/schema");
        const { eq: _eq, and: _and } = await import("drizzle-orm");

        // Find employee by slug
        const emp = await _db.query.aiEmployees.findFirst({
          where: _eq(_emp.slug, assignedEmployeeSlug),
        });
        if (!emp) return { error: `未找到员工：${assignedEmployeeSlug}` };

        // Resolve dependency IDs from titles
        const deps: string[] = [];
        if (dependencyTitles.length > 0) {
          const allTasks = await _db
            .select({ id: _mt.id, title: _mt.title })
            .from(_mt)
            .where(_eq(_mt.missionId, context.missionId));
          for (const depTitle of dependencyTitles) {
            const found = allTasks.find((t) => t.title === depTitle);
            if (found) deps.push(found.id);
          }
        }

        const [task] = await _db
          .insert(_mt)
          .values({
            missionId: context.missionId,
            title,
            description,
            expectedOutput,
            assignedEmployeeId: emp.id,
            dependencies: deps,
            priority,
            status: deps.length > 0 ? "pending" : "ready",
          })
          .returning({ id: _mt.id });

        return { created: true, taskId: task.id, title, assignedTo: assignedEmployeeSlug };
      },
    });

    tools["check_progress"] = tool({
      description: "查看当前任务板上所有任务的执行状态",
      inputSchema: z.object({}),
      execute: async () => {
        const { db: _db } = await import("@/db");
        const { missionTasks: _mt, aiEmployees: _emp } = await import("@/db/schema");
        const { eq: _eq } = await import("drizzle-orm");

        const tasks = await _db
          .select({
            id: _mt.id,
            title: _mt.title,
            status: _mt.status,
            assignedEmployeeId: _mt.assignedEmployeeId,
          })
          .from(_mt)
          .where(_eq(_mt.missionId, context.missionId));

        // Load employee slugs for display
        const empIds = [...new Set(tasks.filter((t) => t.assignedEmployeeId).map((t) => t.assignedEmployeeId!))];
        const empMap = new Map<string, string>();
        for (const eid of empIds) {
          const emp = await _db.query.aiEmployees.findFirst({ where: _eq(_emp.id, eid) });
          if (emp) empMap.set(eid, emp.slug);
        }

        return {
          tasks: tasks.map((t) => ({
            title: t.title,
            status: t.status,
            assignedTo: t.assignedEmployeeId ? empMap.get(t.assignedEmployeeId) : null,
          })),
          total: tasks.length,
          completed: tasks.filter((t) => t.status === "completed").length,
          inProgress: tasks.filter((t) => t.status === "in_progress").length,
          pending: tasks.filter((t) => t.status === "pending" || t.status === "ready").length,
        };
      },
    });
  }

  return tools;
}

// ---------------------------------------------------------------------------
// Knowledge Base retrieval tools (injected when employee has KB bindings)
// ---------------------------------------------------------------------------

export function createKnowledgeBaseTools(context: {
  employeeKnowledgeBaseIds: string[];
}): ToolSet {
  const tools: ToolSet = {};

  if (context.employeeKnowledgeBaseIds.length === 0) {
    return tools;
  }

  tools["kb_search"] = tool({
    description:
      "在你绑定的知识库中按语义检索相关内容片段。返回与 query 最相关的文档片段。当需要参考组织内部资料、风格指南、敏感词或领域知识时使用。",
    inputSchema: z.object({
      query: z.string().describe("自然语言检索 query"),
      kb_ids: z
        .array(z.string())
        .optional()
        .describe("可选：指定只检索某些知识库 ID。不传则检索所有绑定的知识库"),
      top_k: z.number().int().min(1).max(20).optional().default(5).describe("返回结果数，默认 5"),
    }),
    execute: async ({ query, kb_ids, top_k = 5 }) => {
      const { searchKnowledgeBases } = await import("@/lib/knowledge/retrieval");
      const { db: _db } = await import("@/db");
      const { knowledgeBases: _kb } = await import("@/db/schema");
      const { inArray: _inArray, eq: _eq, and: _and } = await import("drizzle-orm");

      // Filter kb_ids: must be in employee's bound list
      const allowedSet = new Set(context.employeeKnowledgeBaseIds);
      let targetIds = context.employeeKnowledgeBaseIds;
      if (kb_ids && kb_ids.length > 0) {
        targetIds = kb_ids.filter((id) => allowedSet.has(id));
      }

      if (targetIds.length === 0) {
        return {
          hits: [],
          warnings: ["没有可用的知识库"],
        };
      }

      // Only search KBs that are vectorized (status = done)
      const kbStatuses = await _db
        .select({ id: _kb.id, name: _kb.name, status: _kb.vectorizationStatus })
        .from(_kb)
        .where(_inArray(_kb.id, targetIds));

      const ready = kbStatuses.filter((k) => k.status === "done").map((k) => k.id);
      const notReady = kbStatuses.filter((k) => k.status !== "done");

      const warnings: string[] = [];
      for (const k of notReady) {
        warnings.push(`知识库「${k.name}」未完成向量化（状态：${k.status}），已跳过`);
      }

      if (ready.length === 0) {
        return { hits: [], warnings };
      }

      try {
        const hits = await searchKnowledgeBases(query, ready, top_k);
        return {
          hits: hits.map((h) => ({
            title: h.title,
            snippet: h.snippet,
            relevance: Math.round(h.relevance * 1000) / 1000,
          })),
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      } catch (err) {
        return {
          hits: [],
          error: `知识库检索失败：${err instanceof Error ? err.message : String(err)}`,
          warnings: warnings.length > 0 ? warnings : undefined,
        };
      }
    },
  });

  return tools;
}

export function toVercelTools(
  agentTools: AgentTool[],
  pluginConfigs?: Map<string, { description: string; config: PluginConfig }>,
  missionTools?: ToolSet,
  knowledgeBaseTools?: ToolSet
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

  // Merge mission collaboration tools if provided
  if (missionTools) {
    Object.assign(result, missionTools);
  }

  // Merge knowledge base retrieval tools if provided
  if (knowledgeBaseTools) {
    Object.assign(result, knowledgeBaseTools);
  }

  return result;
}
