import { tool, type ToolSet } from "ai";
import { z } from "zod/v4";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getBuiltinSkillNameToSlug } from "@/lib/skill-loader";
import {
  fetchViaJinaReader,
  fetchViaCheerio,
  truncateContent,
  inferSourceType,
  inferCredibility,
  parseDate,
  type NewsFeedItem,
  type SourceType,
} from "@/lib/web-fetch";
import { searchWeb, isSearchProviderConfigured, getActiveSearchProvider } from "@/lib/search";
import { DEFAULT_INCLUDE_DOMAINS, DEFAULT_EXCLUDE_DOMAINS } from "@/lib/search/types";
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

export function normalizeBatchDeepReadItems<T extends Record<string, unknown>>(
  items: T[],
): Array<T & { id: string; sourceUrl?: string }> {
  return items.map((item, index) => {
    const sourceUrl =
      typeof item.sourceUrl === "string" && item.sourceUrl.trim()
        ? item.sourceUrl.trim()
        : typeof item.url === "string" && item.url.trim()
          ? item.url.trim()
          : undefined;
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : sourceUrl ?? `item-${index + 1}`;
    return {
      ...item,
      id,
      ...(sourceUrl ? { sourceUrl } : {}),
    } as T & { id: string; sourceUrl?: string };
  });
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

type ArchiveDraftArticleInput = {
  title: string;
  body: string;
  language?: "zh" | "en";
  sourceUrl?: string;
  culturalNotes?: string;
};

function countCjkChars(value: string) {
  return [...value].filter((ch) => /[\u3400-\u9fff]/u.test(ch)).length;
}

function detectArchiveInputFailure(
  item: ArchiveDraftArticleInput,
): string | null {
  const haystack = [item.title, item.body, item.culturalNotes ?? ""].join("\n");
  if (/\[\s*NEEDS\s*REVIEW\s*\]/i.test(haystack)) {
    return "needs_review_fallback";
  }
  if (
    /LLM\s+did\s+not\s+return\s+a\s+rewrite/i.test(haystack) ||
    /Original\s+Chinese\s+body\s+preserved/i.test(haystack) ||
    /已兜底标记\s*NEEDS\s*REVIEW/i.test(haystack) ||
    /该条\s*LLM\s*调用失败/.test(haystack)
  ) {
    return "rewrite_failure_fallback";
  }

  if ((item.language ?? "en") === "en") {
    const titleChars = [...item.title].length;
    const bodyChars = [...item.body].length;
    const titleCjk = countCjkChars(item.title);
    const bodyCjk = countCjkChars(item.body);
    const titleLooksChinese =
      titleCjk >= 4 && titleCjk / Math.max(titleChars, 1) > 0.15;
    const bodyLooksChinese =
      bodyCjk >= 20 && bodyCjk / Math.max(bodyChars, 1) > 0.1;
    if (titleLooksChinese || bodyLooksChinese) {
      return "non_english_content_for_en";
    }
  }

  return null;
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
        includeDomains: z.array(z.string()).optional()
          .describe("白名单域名（领域权威源）；与默认源合并，优先返回这些域名的结果"),
      }),
      execute: async ({ query, timeRange, sources, maxResults = 8, topic, includeDomains }) => {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
          return {
            success: false,
            error: {
              code: "parameter_binding",
              message: "查询词不能为空",
            },
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
        const retrievalErrors: string[] = [];
        let channelSucceeded = false;
        let fetchedItems: NewsFeedItem[] = [];
        let tavilyAnswer: string | undefined;

        // --- Primary channel: configured web search provider (Bocha / Tavily) ---
        if (isSearchProviderConfigured()) {
          const providerId = getActiveSearchProvider();
          try {
            const searchResult = await searchWeb(trimmedQuery, {
              timeRange,
              maxResults: limitedResults,
              topic,
              includeDomains: Array.from(new Set([
                ...DEFAULT_INCLUDE_DOMAINS,
                ...(includeDomains ?? []),
              ])),
              excludeDomains: DEFAULT_EXCLUDE_DOMAINS,
            });
            fetchedItems = searchResult.items;
            tavilyAnswer = searchResult.answer;
            channelSucceeded = true;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            retrievalErrors.push(`${providerId}: ${message}`);
            warnings.push(`${providerId} 通道失败: ${message}，回退到 RSS`);
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
          if (settled.some((result) => result.status === "fulfilled")) {
            channelSucceeded = true;
          }
          retrievalErrors.push(
            ...settled
              .filter((r): r is PromiseRejectedResult => r.status === "rejected")
              .map((r) =>
                r.reason instanceof Error ? r.reason.message : String(r.reason),
              ),
          );
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
          success: channelSucceeded,
          error: channelSucceeded
            ? null
            : {
                code: "external_service",
                message:
                  retrievalErrors.join("; ") ||
                  "所有检索通道均不可用",
              },
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
            channel: fetchedItems.length > 0 && isSearchProviderConfigured()
              ? getActiveSearchProvider()
              : "rss",
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
    batch_deep_read: tool({
      description:
        "批量调用 Jina Reader 抓取多条 item 的 sourceUrl 详情页正文，把抓到的全文写入每条 item 的 `body` 字段，原字段（id / title / category / sourceUrl 等）原样透传。" +
        "用于「海外热榜搬运」step 3：把分类后的中文热点详情页内容抓下来交给翻译改写步骤。" +
        "失败的条目用 summary 兜底（若无 summary 则保留 title），不会丢条。",
      inputSchema: z.object({
        items: z
          .array(
            z
              .object({
                id: z.string().min(1).optional().describe("条目 id；缺失时由 URL 或序号生成"),
                url: z.string().optional().describe("web_search 返回的 URL 别名"),
                sourceUrl: z.string().optional().describe("详情页 URL（可选；缺失则 body 用 summary 兜底）"),
                title: z.string().optional(),
                summary: z.string().optional(),
                category: z.string().optional(),
                confidence: z.number().optional(),
                reason: z.string().optional(),
              })
              .passthrough(),
          )
          .min(0)
          .max(50)
          .describe("待深读的条目列表（一般来自 topic_classifier 的 results，最多 50 条对齐 trending_topics 上限）。空数组优雅返回 0 条结果,不触发 zod 拒绝。"),
        maxLength: z.number().optional().default(5000).describe("单篇正文截断字数，默认 5000"),
        maxConcurrency: z.number().optional().default(3).describe("并发抓取数，默认 3"),
        confidenceThreshold: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .default(0.7)
          .describe("分类置信度门槛，低于此值或 category=other 的条目直接走 summary 兜底，不浪费 Jina 配额"),
        // 实测得出的反爬平台黑名单(2026-05-28):
        //   zhihu / weixin / douyin / xiaohongshu / bilibili 抓回的全是反爬登录页,
        //   LLM 拿到会"翻译"成 "🔒 Verify to Unlock Expert Insights" 这种假内容入库。
        //   黑名单内的 host 直接走 summary 兜底,不调 Jina,不让 LLM 看到反爬页。
        // 用户可在 workflow 编辑器 step 3 paramConfig 里覆盖这个 list。
        blockedHosts: z
          .array(z.string())
          .optional()
          .default([
            "zhihu.com",
            "mp.weixin.qq.com",
            "douyin.com",
            "xiaohongshu.com",
            "bilibili.com",
            "b23.tv",
          ])
          .describe("反爬平台 host 黑名单,命中直接走 summary 兜底不调 Jina"),
      }),
      execute: async ({
        items: rawItems,
        maxLength = 5000,
        maxConcurrency = 3,
        confidenceThreshold = 0.7,
        blockedHosts = [
          "zhihu.com",
          "mp.weixin.qq.com",
          "douyin.com",
          "xiaohongshu.com",
          "bilibili.com",
          "b23.tv",
          // 2026-05-30 — Weibo 热点 sourceUrl 本质是搜索页(s.weibo.com/weibo?q=...,
          // m.weibo.cn/search?containerid=...),Jina 抓回登录页或搜索结果列表 markdown,
          // 不是单篇文章。下游翻译爆 token + JSON 拒绝 → 全部 [NEEDS REVIEW] 入库垃圾稿。
          "weibo.com",
          "weibo.cn",
        ],
      }) => {
        const items = normalizeBatchDeepReadItems(rawItems);
        // 上游 0 条 → 优雅返回。之前 schema 是 min(1),空数组被 zod 拒绝 →
        // mission-executor fallthrough 到 agent LLM 路径 → LLM 凭空编"详情正文
        // 摘要"假数据塞进 outputData,user 看到绿色"已完成"但实际是欺骗。
        if (!items || items.length === 0) {
          return {
            items: [],
            totalRequested: 0,
            okCount: 0,
            fallbackCount: 0,
            skippedCount: 0,
            note: "上游 topic_classifier 产出 0 条,本步骤无可抓取详情。常见原因:topic_classifier 把所有热点归 other(用户配置 categories 跟热榜不匹配)。",
          };
        }
        // 简易并发池：分批 Promise.all，限制并发避免 Jina 限流。
        type EnrichedItem = Record<string, unknown> & {
          id: string;
          body: string;
          fetchedAt: string;
          fetchStatus:
            | "ok"
            | "fallback_summary"
            | "fallback_title"
            | "skipped_other"
            | "enriched_via_bocha"
            | "enriched_via_bocha_failed"
            | "failed";
          fetchError?: string;
        };
        const enriched: EnrichedItem[] = [];
        let okCount = 0;
        let fallbackCount = 0;
        let skippedCount = 0;
        let enrichedCount = 0;

        // 2026-05-30 — bocha fallback enrichment helper。
        // Jina 不可用(反爬黑名单 / 搜索页 URL / 短内容 / throw)时,用 item.title 调 bocha
        // 拿 top 3 snippet 拼成 markdown 给下游翻译 LLM 上下文 —— 不再只丢一行 title 进 step 4。
        async function tryBochaEnrich(
          item: Record<string, unknown> & { id: string; title?: string; summary?: string },
        ): Promise<{ body: string; status: "enriched_via_bocha" | "fallback" }> {
          const fallbackBody = (item.summary ?? "").trim() || (item.title ?? "").trim() || item.id;
          const query = (item.title ?? "").trim();
          if (!query) return { body: fallbackBody, status: "fallback" };
          try {
            const { searchWeb } = await import("@/lib/search");
            const res = await searchWeb(query, { forceProvider: "bocha", maxResults: 3, topic: "news" });
            if (!res.items || res.items.length === 0) return { body: fallbackBody, status: "fallback" };
            const sections = res.items.slice(0, 3).map((it) => {
              const parts = [it.title ? `# ${it.title}` : "", it.source ? `_来源:${it.source}_` : "", it.snippet ?? ""].filter(Boolean);
              return parts.join("\n");
            });
            const body = sections.join("\n\n---\n\n").trim();
            if (body.length < 50) return { body: fallbackBody, status: "fallback" };
            return { body, status: "enriched_via_bocha" };
          } catch {
            return { body: fallbackBody, status: "fallback" };
          }
        }

        for (let i = 0; i < items.length; i += maxConcurrency) {
          const batch = items.slice(i, i + maxConcurrency);
          const batchResults = await Promise.all(
            batch.map(async (item): Promise<EnrichedItem> => {
              const base: Record<string, unknown> = { ...item };

              // 短路：category=other 或 confidence < 阈值 → 不抓 URL,直接
              // summary 兜底。这些条目下游 cross_language_rewrite 也会 filter
              // 掉,抓详情纯浪费 Jina 配额(50 条里通常 30+ 是 other)。
              const isOther = item.category === "other";
              const lowConf =
                typeof item.confidence === "number" &&
                item.confidence < confidenceThreshold;
              if (isOther || lowConf) {
                skippedCount++;
                const body =
                  (item.summary ?? "").trim() ||
                  (item.title ?? "").trim() ||
                  (item.id ?? "");
                return {
                  ...base,
                  id: item.id,
                  body,
                  fetchedAt: new Date().toISOString(),
                  fetchStatus: "skipped_other",
                  fetchError: isOther
                    ? "category=other,跳过抓取"
                    : `confidence ${item.confidence} < ${confidenceThreshold},跳过抓取`,
                };
              }

              const url = (item.sourceUrl ?? "").trim();
              if (!url) {
                fallbackCount++;
                const body = (item.summary ?? "").trim() || (item.title ?? "").trim() || (item.id ?? "");
                return {
                  ...base,
                  id: item.id,
                  body,
                  fetchedAt: new Date().toISOString(),
                  fetchStatus: item.summary ? "fallback_summary" : "fallback_title",
                  fetchError: "无 sourceUrl",
                };
              }
              let parsedUrl: URL;
              try {
                parsedUrl = new URL(url);
              } catch {
                fallbackCount++;
                const body = (item.summary ?? "").trim() || (item.title ?? "").trim() || (item.id ?? "");
                return {
                  ...base,
                  id: item.id,
                  body,
                  fetchedAt: new Date().toISOString(),
                  fetchStatus: item.summary ? "fallback_summary" : "fallback_title",
                  fetchError: "URL 格式无效",
                };
              }
              // 黑名单 host 短路 —— 命中反爬平台直接走 summary,不调 Jina。
              // host 匹配规则:把 www. / m. / s. / bbs. / mp. 等子域前缀剥掉
              // 后再 endsWith 黑名单条目。这样 "m.weixin.qq.com" 能命中黑名单
              // "mp.weixin.qq.com" 同根域。
              const rawHost = parsedUrl.host.toLowerCase();
              const normalizedHost = rawHost
                .replace(/^www\./, "")
                .replace(/^m\./, "")
                .replace(/^s\./, "")
                .replace(/^bbs\./, "")
                .replace(/^mp\./, "");
              const isBlocked = blockedHosts.some((blocked) => {
                const b = blocked.toLowerCase().replace(/^www\./, "");
                return normalizedHost === b || normalizedHost.endsWith("." + b);
              });
              if (isBlocked) {
                const enr = await tryBochaEnrich(item);
                if (enr.status === "enriched_via_bocha") {
                  enrichedCount++;
                  return {
                    ...base,
                    id: item.id,
                    body: enr.body,
                    fetchedAt: new Date().toISOString(),
                    fetchStatus: "enriched_via_bocha",
                    fetchError: `${rawHost} 反爬,改走 bocha 搜索 title`,
                  };
                }
                fallbackCount++;
                return {
                  ...base,
                  id: item.id,
                  body: enr.body,
                  fetchedAt: new Date().toISOString(),
                  fetchStatus: item.summary ? "fallback_summary" : "fallback_title",
                  fetchError: `${rawHost} 反爬 + bocha 未命中,用 summary 兜底`,
                };
              }
              // 2026-05-30 URL-shape filter:搜索/列表页 URL(s.weibo / m.weibo / baidu/s / toutiao/search etc.)
              // 不调 Jina,直接 bocha,因为 Jina 抓搜索页只返回列表 markdown,不是文章正文。
              const pathname = parsedUrl.pathname.toLowerCase();
              const search = parsedUrl.search.toLowerCase();
              const looksLikeSearchPage =
                pathname.includes("/search") ||
                pathname.includes("/s.html") ||
                /[?&]q=/i.test(search) ||
                /[?&]wd=/i.test(search) ||
                /[?&]keyword=/i.test(search) ||
                /[?&]containerid=100103/i.test(search);
              if (looksLikeSearchPage) {
                const enr = await tryBochaEnrich(item);
                if (enr.status === "enriched_via_bocha") {
                  enrichedCount++;
                  return {
                    ...base,
                    id: item.id,
                    body: enr.body,
                    fetchedAt: new Date().toISOString(),
                    fetchStatus: "enriched_via_bocha",
                    fetchError: "URL 是搜索/列表页,改走 bocha 搜索 title",
                  };
                }
                fallbackCount++;
                return {
                  ...base,
                  id: item.id,
                  body: enr.body,
                  fetchedAt: new Date().toISOString(),
                  fetchStatus: item.summary ? "fallback_summary" : "fallback_title",
                  fetchError: "URL 是搜索/列表页 + bocha 未命中,用 summary 兜底",
                };
              }
              try {
                const result = await fetchViaJinaReader(url);
                const truncated = truncateContent(result.content, maxLength);

                // 反爬页面识别 —— 实测知乎/百度/微信对未登录请求返回"安全验证 /
                // 请登录"占位页,Jina 抓到的就是这个登录提示。如果不识别,LLM 拿到
                // 这种登录提示页会"翻译"成"🔒 Verify to Unlock Expert Insights on
                // Zhihu",入库的稿件全是反爬登录页的英文版,不是真内容。
                const antiCrawlerPatterns = [
                  "安全验证",
                  "请登录",
                  "请先登录",
                  "登录后查看",
                  "意见反馈",
                  "jobs@zhihu.com",
                  "Verify to access",
                  "需要登录",
                  "微信公众平台",
                  "Weixin Official Accounts Platform",
                  "登录后继续",
                ];
                const looksLikeAntiCrawler =
                  truncated.length < 500 &&
                  antiCrawlerPatterns.some((p) => truncated.includes(p));

                if (
                  truncated &&
                  truncated.length >= 50 &&
                  !looksLikeAntiCrawler
                ) {
                  okCount++;
                  return {
                    ...base,
                    id: item.id,
                    title: result.title || (item.title ?? ""),
                    body: truncated,
                    fetchedAt: new Date().toISOString(),
                    fetchStatus: "ok",
                  };
                }
                // Jina 返回成功但内容太短 / 命中反爬模式 → bocha → summary 兜底
                const enr = await tryBochaEnrich(item);
                if (enr.status === "enriched_via_bocha") {
                  enrichedCount++;
                  return {
                    ...base,
                    id: item.id,
                    body: enr.body,
                    fetchedAt: new Date().toISOString(),
                    fetchStatus: "enriched_via_bocha",
                    fetchError: looksLikeAntiCrawler
                      ? "Jina 抓到反爬登录页,改走 bocha"
                      : "Jina 返回内容过短,改走 bocha",
                  };
                }
                fallbackCount++;
                return {
                  ...base,
                  id: item.id,
                  body: enr.body,
                  fetchedAt: new Date().toISOString(),
                  fetchStatus: item.summary ? "fallback_summary" : "fallback_title",
                  fetchError: looksLikeAntiCrawler
                    ? "反爬登录页 + bocha 未命中,用 summary 兜底"
                    : "Jina 返回过短 + bocha 未命中,用 summary 兜底",
                };
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                const enr = await tryBochaEnrich(item);
                if (enr.status === "enriched_via_bocha") {
                  enrichedCount++;
                  return {
                    ...base,
                    id: item.id,
                    body: enr.body,
                    fetchedAt: new Date().toISOString(),
                    fetchStatus: "enriched_via_bocha",
                    fetchError: `Jina 抛错(${errMsg.slice(0, 80)}),改走 bocha`,
                  };
                }
                fallbackCount++;
                return {
                  ...base,
                  id: item.id,
                  body: enr.body,
                  fetchedAt: new Date().toISOString(),
                  fetchStatus: "enriched_via_bocha_failed",
                  fetchError: `Jina + bocha 都失败: ${errMsg.slice(0, 150)}`,
                };
              }
            }),
          );
          enriched.push(...batchResults);
        }

        return {
          items: enriched,
          totalRequested: items.length,
          okCount,
          enrichedCount,
          fallbackCount,
          skippedCount,
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
          const message =
            "缺少 TRENDING_API_KEY 环境变量,无法访问 TopHub 热榜 API。";
          return {
            success: false,
            error: { code: "external_service", message },
            fetchedAt: new Date().toISOString(),
            mode,
            platforms: platforms ?? [],
            topics: [],
            crossPlatformTopics: [],
            warnings: [message],
          };
        }

        try {
          items = await fetchTrendingFromApi(mode, { platforms, limit, query });
        } catch (err) {
          const message = `TopHub 热榜 API 调用失败: ${
            err instanceof Error ? err.message : String(err)
          }`;
          return {
            success: false,
            error: { code: "external_service", message },
            fetchedAt: new Date().toISOString(),
            mode,
            platforms: platforms ?? [],
            topics: [],
            crossPlatformTopics: [],
            warnings: [message],
          };
        }

        if (items.length === 0) {
          // API 调用成功但返回 0 条 —— 通常是 TopHub 临时无数据 / 平台过滤后空。
          // 返回 0 条 + warnings,test-run / mission console 会显示黄色 warning 让用户看到。
          warnings.push("TopHub API 调用成功但返回 0 条热榜数据。可能是平台维护中,稍后重试。");
          return {
            success: true,
            error: null,
            fetchedAt: new Date().toISOString(),
            mode,
            platforms: platforms ?? [],
            topics: [],
            crossPlatformTopics: [],
            warnings,
          };
        }

        // buildCrossPlatformTopics 内部已 filter platforms.size>=2，单平台
        // 自然返回空数组，所以 platforms 模式（用户拉多平台时）也跑一遍
        // 是安全的，能展现"跨平台共振"价值；之前只让 mode=hot 跑是过度保守。
        const crossPlatformTopics = buildCrossPlatformTopics(items);
        const activePlatforms = Array.from(new Set(items.map((i) => i.platform)));

        return {
          success: true,
          error: null,
          fetchedAt: new Date().toISOString(),
          mode,
          platforms: activePlatforms,
          totalCount: items.length,
          // 之前 mode=hot 硬切 50 条 —— 但用户传入 limit=30 时期望就是 30 条,
          // 强制 50 让下游 step 2-4 处理量翻 1.7 倍,翻译步骤直接慢 1 分钟+。
          // 现在 hot 模式也遵守 limit,默认 limit=20 时只返 20 条。
          topics: items.slice(0, mode === "hot" ? limit : limit * Math.max(activePlatforms.length, 1)),
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
        const providerId = getActiveSearchProvider();
        if (!isSearchProviderConfigured()) {
          return {
            success: false,
            error: {
              code: "external_service",
              message: `未配置 ${providerId.toUpperCase()}_API_KEY`,
            },
            query,
            generatedAt: new Date().toISOString(),
            results: [],
            warnings: [`未配置 ${providerId.toUpperCase()}_API_KEY，无法聚合新闻`],
          };
        }
        let searchRes;
        try {
          searchRes = await searchWeb(query.trim(), {
            timeRange,
            maxResults: Math.min(maxResults, 20),
            topic,
            includeDomains: DEFAULT_INCLUDE_DOMAINS,
            excludeDomains: DEFAULT_EXCLUDE_DOMAINS,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            success: false,
            error: { code: "external_service", message },
            query,
            generatedAt: new Date().toISOString(),
            results: [],
            warnings: [`${providerId} 通道失败: ${message}`],
          };
        }
        // 字段命名沿用 web_search 的 `results` —— 下游 mission-executor
        // 统一按 `results` 检测 0 / 稀疏结果并注入强约束警示。
        const results = searchRes.items.map((it) => ({
          title: it.title,
          source: it.source,
          sourceType: SOURCE_TYPE_LABELS[it.sourceType],
          credibility: it.credibility,
          url: it.url,
          publishedAt: it.publishedAt,
          snippet: it.snippet,
        }));
        return {
          success: true,
          error: null,
          query,
          generatedAt: new Date().toISOString(),
          timeRange: timeRange ?? "unset",
          totalFetched: searchRes.items.length,
          results,
          summary: searchRes.answer ?? null,
          warnings: results.length === 0 ? [`${providerId} 未命中任何条目，建议放宽 timeRange 或换关键词`] : [],
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

        // 并行：联网搜索新闻 + 多平台热榜搜索
        const activeProvider = getActiveSearchProvider();
        const [searchRes, trendingRes] = await Promise.allSettled([
          isSearchProviderConfigured()
            ? searchWeb(q, {
                timeRange,
                maxResults: 8,
                topic: "news",
                includeDomains: DEFAULT_INCLUDE_DOMAINS,
                excludeDomains: DEFAULT_EXCLUDE_DOMAINS,
              })
            : Promise.reject(new Error(`${activeProvider.toUpperCase()}_API_KEY 未配置`)),
          process.env.TRENDING_API_KEY
            ? fetchTrendingFromApi("search", { query: q, limit: 20 })
            : Promise.reject(new Error("TRENDING_API_KEY 未配置")),
        ]);

        const newsItems =
          searchRes.status === "fulfilled"
            ? searchRes.value.items.slice(0, 8).map((it) => ({
                title: it.title,
                source: it.source,
                url: it.url,
                publishedAt: it.publishedAt,
              }))
            : [];
        if (searchRes.status === "rejected") {
          warnings.push(`${activeProvider}: ${searchRes.reason instanceof Error ? searchRes.reason.message : String(searchRes.reason)}`);
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
          success:
            searchRes.status === "fulfilled" ||
            trendingRes.status === "fulfilled",
          error:
            searchRes.status === "rejected" &&
            trendingRes.status === "rejected"
              ? {
                  code: "external_service",
                  message: warnings.join("; "),
                }
              : null,
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
            success: false,
            error: {
              code: "external_service",
              message: "未配置 TRENDING_API_KEY",
            },
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
            success: true,
            error: null,
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
            success: false,
            error: {
              code: "external_service",
              message: err instanceof Error ? err.message : String(err),
            },
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

        const activeProvider = getActiveSearchProvider();
        const [newsRes, trendingRes] = await Promise.allSettled([
          isSearchProviderConfigured()
            ? searchWeb(q, {
                timeRange,
                maxResults: 20,
                topic: "news",
                includeDomains: DEFAULT_INCLUDE_DOMAINS,
                excludeDomains: DEFAULT_EXCLUDE_DOMAINS,
              })
            : Promise.reject(new Error(`${activeProvider.toUpperCase()}_API_KEY 未配置`)),
          process.env.TRENDING_API_KEY
            ? fetchTrendingFromApi("search", { query: q, limit: 30 })
            : Promise.reject(new Error("TRENDING_API_KEY 未配置")),
        ]);

        const newsItems = newsRes.status === "fulfilled" ? newsRes.value.items : [];
        if (newsRes.status === "rejected") {
          warnings.push(`${activeProvider}: ${newsRes.reason instanceof Error ? newsRes.reason.message : String(newsRes.reason)}`);
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
        "把一篇稿件真实入库到华栖云 CMS。**两种使用模式**：" +
        "(A) 推送已存在稿件：传 `articleId`（与 archive_to_drafts 串联用），跳过新建直接推送；" +
        "(B) 一步创建并推送：传 `title + body`，新建 articles 行后推送（旧路径）。" +
        "目标栏目支持参数化：传入 catalogId 即推到指定栏目；不传走 env `CMS_DEFAULT_CATALOG_ID`。" +
        "appId/siteId 同理（默认 1768/81）。" +
        "前置：env 里 CMS_HOST / CMS_LOGIN_CMC_ID / CMS_LOGIN_CMC_TID / CMS_TENANT_ID + " +
        "VIBETIDE_CMS_PUBLISH_ENABLED=true。",
      inputSchema: z
        .object({
          articleId: z
            .string()
            .uuid()
            .optional()
            .describe(
              "已存在的 article ID（UUID）。提供时跳过新建直接推送现有稿件到 CMS。" +
                "与上游 archive_to_drafts 串联：articleId = {{stepN.created.0.articleId}}",
            ),
          title: z
            .string()
            .optional()
            .describe("稿件标题（articleId 未提供时必填）"),
          body: z
            .string()
            .optional()
            .describe(
              "稿件正文（articleId 未提供时必填；纯文本/Markdown，mapper 会转 CMS content blocks）",
            ),
          summary: z.string().optional().describe("摘要（50-120 字）"),
          authorName: z
            .string()
            .optional()
            .describe("作者，默认 'AI 编辑部'"),
          coverImageUrl: z.string().optional().describe("封面图 URL"),
          tags: z.array(z.string()).optional().describe("标签数组"),
          catalogId: z
            .number()
            .int()
            .optional()
            .describe("目标 CMS 栏目 ID。不填走 env CMS_DEFAULT_CATALOG_ID（默认 10210）"),
          appId: z
            .number()
            .int()
            .optional()
            .describe("CMS APP 应用 ID。不填走 env CMS_DEFAULT_APP_ID（默认 1768）"),
          siteId: z
            .number()
            .int()
            .optional()
            .describe("CMS 站点 ID。不填走 env CMS_DEFAULT_SITE_ID（默认 81）"),
          dryRun: z
            .boolean()
            .optional()
            .describe("dry-run 模式，不写 DB 不调 CMS，用于 skill 测试入口（M1）"),
          // 下面两个由执行器注入，用户在"参数配置"里不需要填。
          organizationId: z
            .string()
            .optional()
            .describe("组织 ID（由 workflow 执行器自动注入）"),
          operatorId: z
            .string()
            .optional()
            .describe("操作者 ID（由 workflow 执行器自动注入）"),
        })
        .refine(
          (data) => Boolean(data.articleId) || Boolean(data.title && data.body),
          {
            message:
              "必须提供 articleId（推送已存在稿件），或同时提供 title 和 body（新建并推送）",
          },
        ),
      execute: async ({
        title,
        body,
        summary,
        authorName,
        coverImageUrl,
        tags,
        articleId: existingArticleId,
        catalogId,
        appId,
        siteId,
        dryRun,
        organizationId,
        operatorId,
      }) => {
        // Phase 4: 目标栏目支持运行时参数化。catalogId/appId/siteId 任一非空 →
        // 走 target override；全 undefined → target=undefined,publishArticleToCms
        // 内部 loadMapperContext 会回退到 config.default*。
        const target =
          catalogId != null || appId != null || siteId != null
            ? { catalogId, appId, siteId }
            : undefined;

        // 用于 dryRun / meta 回显真实生效值（不管 target 是否存在都要算 effective）
        const { requireCmsConfig } = await import("@/lib/cms/feature-flags");
        const config = requireCmsConfig();
        const effective = {
          catalogId: catalogId ?? config.defaultCatalogId,
          appId: appId ?? config.defaultAppId,
          siteId: siteId ?? config.defaultSiteId,
        };

        // ─── dryRun 短路（M1 验收：测试入口不污染 DB / 不调 CMS） ────────
        // 必须放在 organizationId 校验之前 + articles insert 之前 —— 否则测试
        // 仍会污染 articles 表导致验收 SQL 失败。
        if (dryRun) {
          return {
            success: true,
            dryRun: true,
            mode: existingArticleId ? "republish_existing" : "create_and_publish",
            wouldInsert: existingArticleId
              ? undefined
              : {
                  title,
                  body,
                  summary,
                  organizationId,
                  tags: tags ?? [],
                },
            wouldFetchArticleId: existingArticleId ?? undefined,
            wouldPublish: {
              catalogId: effective.catalogId,
              appId: effective.appId,
              siteId: effective.siteId,
              authorName: authorName ?? "AI 编辑部",
            },
            note: existingArticleId
              ? "dry-run: 实际跑会 SELECT 现有 article 并调 publishArticleToCms 9 步流程"
              : "dry-run: 实际跑会先 insert articles 行（status=approved）再调 publishArticleToCms 9 步流程",
          };
        }
        // ─────────────────────────────────────────────────────────────────

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

        // ─── 决定 articleId 来源：existingArticleId 优先（republish 模式），
        //     否则 INSERT 新行（create_and_publish 模式） ───────────────
        let articleId: string;

        if (existingArticleId) {
          // 模式 A: 推送已存在稿件
          const { getArticleById } = await import("@/lib/dal/articles");
          const existing = await getArticleById(existingArticleId);
          if (!existing) {
            return {
              success: false,
              error: {
                code: "article_not_found",
                message: `article ${existingArticleId} 不存在`,
                stage: "config" as const,
              },
            };
          }
          if (existing.organizationId !== organizationId) {
            return {
              success: false,
              error: {
                code: "article_org_mismatch",
                message: "article 不属于当前组织，不允许跨 org 发布",
                stage: "config" as const,
              },
            };
          }
          articleId = existingArticleId;
        } else {
          // 模式 B: 旧路径，新建 article（refine 已保证 title + body 非空）
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
              title: title!, // refine 已保证非空
              body: body!,
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
          articleId = created.id;
        }

        // ─── 共用路径：调 publishArticleToCms 完整走 9 步（含 cms_publications
        //     审计 + Inngest 轮询事件）。feature flag / config 校验都由它内部做。 ──
        const { publishArticleToCms } = await import("@/lib/cms");
        try {
          const pubResult = await publishArticleToCms({
            articleId,
            operatorId: operatorId ?? "workflow_system",
            triggerSource: "workflow",
            allowUpdate: true,
            target,
          });
          return {
            success: pubResult.success,
            mode: existingArticleId ? "republish_existing" : "create_and_publish",
            articleId,
            publicationId: pubResult.publicationId,
            cmsArticleId: pubResult.cmsArticleId,
            cmsState: pubResult.cmsState,
            publishedUrl: pubResult.publishedUrl,
            previewUrl: pubResult.previewUrl,
            timings: pubResult.timings,
            meta: {
              title: existingArticleId ? "(从 article 表读取)" : title,
              catalogId: effective.catalogId,
              appId: effective.appId,
              siteId: effective.siteId,
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
            mode: existingArticleId ? "republish_existing" : "create_and_publish",
            articleId,
            error: { code: `cms_${stage}`, message, stage },
            meta: {
              catalogId: effective.catalogId,
              appId: effective.appId,
              siteId: effective.siteId,
            },
          };
        }
      },
    }),
    // 2026-05-30 批量版 cms_publish。接受 archive_to_drafts 输出的 articles[]
    // (每条带 articleId),循环调 publishArticleToCms 把每篇已入库稿件推到 CMS。
    // 跟单篇 cms_publish 的关键区别:这里假定上游已经入 articles 表,只发布不再 INSERT。
    cms_batch_publish: tool({
      description:
        "批量把一组已入库稿件(articleId 数组,通常来自 archive_to_drafts 输出)发布到华栖云 CMS。" +
        "循环调 publishArticleToCms,单条失败不影响其他。返回 published / failed 两个数组。" +
        "前置:env 里 CMS_HOST/CMS_LOGIN_CMC_ID/CMS_LOGIN_CMC_TID/CMS_TENANT_ID + VIBETIDE_CMS_PUBLISH_ENABLED=true。",
      inputSchema: z.object({
        articles: z
          .array(
            z.object({
              articleId: z.string().min(1),
              title: z.string().optional(),
              sourceUrl: z.string().optional(),
            }).passthrough(),
          )
          .min(0).max(50)
          .describe("待发布稿件,通常绑 {{stepN.created}}"),
        catalogId: z.number().int().optional(),
        appId: z.number().int().optional(),
        siteId: z.number().int().optional(),
        allowUpdate: z.boolean().optional().default(true),
        dryRun: z.boolean().optional(),
        organizationId: z.string().optional(),
        operatorId: z.string().optional(),
        missionId: z.string().optional(),
        taskId: z.string().optional(),
      }),
      execute: async ({ articles, catalogId, appId, siteId, allowUpdate = true, dryRun, organizationId, operatorId }) => {
        if (!articles || articles.length === 0) {
          return {
            success: true, totalRequested: 0, totalPublished: 0, totalFailed: 0,
            published: [], failed: [],
            note: "上游 archive_to_drafts 产出 0 条稿件,本步骤无可发布内容。",
          };
        }
        if (dryRun) {
          return {
            success: true,
            dryRun: true,
            totalRequested: articles.length,
            totalPublished: articles.length,
            totalFailed: 0,
            wouldPublish: articles.length,
            published: articles.map((item, index) => ({
              articleId: item.articleId,
              publicationId: `dry-run-publication-${index + 1}`,
              cmsState: "dry_run",
            })),
            failed: [],
          };
        }
        if (!organizationId) {
          return { success: false, error: { code: "missing_context", message: "缺少 organizationId" } };
        }
        if (!operatorId) {
          return { success: false, error: { code: "missing_context", message: "缺少 operatorId" } };
        }
        const target = (catalogId !== undefined || appId !== undefined || siteId !== undefined)
          ? { catalogId, appId, siteId } : undefined;
        const { publishArticleToCms } = await import("@/lib/cms/publish");
        const published: Array<{ articleId: string; publicationId: string; cmsArticleId?: string; cmsState: string; publishedUrl?: string }> = [];
        const failed: Array<{ articleId: string; stage?: string; code?: string; message: string; retriable?: boolean }> = [];
        // 串行循环避免并发打爆 CMS
        for (const item of articles) {
          try {
            const r = await publishArticleToCms({
              articleId: item.articleId, operatorId, triggerSource: "workflow", allowUpdate, target,
            });
            if (r.success) {
              published.push({
                articleId: item.articleId, publicationId: r.publicationId,
                cmsArticleId: r.cmsArticleId, cmsState: r.cmsState, publishedUrl: r.publishedUrl,
              });
            } else {
              failed.push({
                articleId: item.articleId, stage: r.error?.stage, code: r.error?.code,
                message: r.error?.message ?? "CMS 返回 success=false", retriable: r.error?.retriable,
              });
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const name = err instanceof Error ? err.name : "";
            const stage = name.includes("Auth") ? "auth"
              : name.includes("Business") ? "cms_business"
              : name.includes("Network") ? "network"
              : name.includes("Schema") ? "cms_schema"
              : name.includes("Config") ? "config" : undefined;
            failed.push({ articleId: item.articleId, stage, message: msg, retriable: name.includes("Network") || name.includes("Auth") });
          }
        }
        // 任一失败 → success=false,defense #1 标 step failed
        return {
          success: failed.length === 0,
          totalRequested: articles.length,
          totalPublished: published.length,
          totalFailed: failed.length,
          published, failed,
          ...(failed.length > 0 ? {
            error: { code: "partial_or_total_failure", message: `${failed.length}/${articles.length} 条发布失败,详见 failed 数组` },
          } : {}),
        };
      },
    }),
    archive_to_drafts: tool({
      description:
        "把一批稿件批量写入个人稿件库（articles 表）作为指定状态，等待编辑后续处理。" +
        "**只入本地 DB，不调任何外部 CMS / 发布接口**。" +
        "适合：海外热榜搬运、跨语言改写等需要把生成内容落库待审的场景。" +
        "若同 org 下 sourceUrl 已存在则按 dedupBySourceUrl 决定 skip。",
      inputSchema: z.object({
        // min(0): 上游 cross_language_rewrite filter 后可能 0 条(全 other / 全
        // 低置信度)。让本步骤优雅返回"上游 0 条,无可入库稿件"而不是 zod 拒绝,
        // 这样 UI 上能看到完整的"step 4 → step 5"数据流真相,而不是 step 5
        // 红色"参数校验失败"误导用户以为 step 5 出错。
        // max 从 20 提到 50,对齐 trending_topics 50 条上限。
        articles: z.array(z.object({
          title: z.string().min(1).max(200),
          body: z.string().min(10),
          summary: z.string().optional(),
          sourceUrl: z.string().optional(),
          sourceTopicId: z.string().optional(),
          variantIndex: z.number().int().min(0).max(2).optional(),
          language: z.enum(["zh", "en"]).optional().default("en"),
          category: z.string().optional(),
          tags: z.array(z.string()).optional(),
          hashtags: z.array(z.string()).optional(),
          culturalNotes: z.string().optional(),
        })).min(0).max(50),
        dedupBySourceUrl: z.boolean().optional().default(true),
        initialStatus: z.enum(["draft", "approved"]).optional().default("approved"),
        dryRun: z.boolean().optional(),
        organizationId: z.string().optional(),
        operatorId: z.string().optional(),
        missionId: z.string().optional(),
        taskId: z.string().optional(),
        // 渠道来源标记（钉钉/企微 IM 对话产出走此路落库时带上）。写入每篇
        // metadata.ingestedFromChannel，供稿件库「来源」筛选区分 IM 产出 vs 工作流/手动。
        ingestedFromChannel: z
          .object({
            platform: z.string(),
            configId: z.string(),
            chatId: z.string(),
            externalUserId: z.string(),
            externalMessageId: z.string().optional(),
          })
          .optional(),
      }),
      execute: async ({
        articles: items,
        dedupBySourceUrl,
        initialStatus,
        dryRun,
        organizationId,
        operatorId,
        missionId,
        taskId,
        ingestedFromChannel,
      }) => {
        // 上游 0 条:优雅返回,UI 显示"无可入库稿件",而不是失败。
        if (!items || items.length === 0) {
          return {
            success: true,
            totalRequested: 0,
            totalCreated: 0,
            totalSkipped: 0,
            created: [],
            skipped: [],
            note: "上游 cross_language_rewrite 产出 0 条稿件,本步骤无入库动作。常见原因:topic_classifier 把所有热点归为 other 类(用户配置的 categories 跟实际热榜不匹配),或 cross_language_rewrite filter 阶段全过滤掉低置信度条目。",
          };
        }

        const failedInput = items
          .map((item, index) => {
            const reason = detectArchiveInputFailure(item);
            return reason
              ? { index, title: item.title, sourceUrl: item.sourceUrl, reason }
              : null;
          })
          .filter((item): item is {
            index: number;
            title: string;
            sourceUrl: string | undefined;
            reason: string;
          } =>
            item !== null,
          );
        const failedIndexes = new Set(failedInput.map((item) => item.index));
        const validItems = items.filter((_, index) => !failedIndexes.has(index));
        if (validItems.length === 0 && failedInput.length > 0) {
          return {
            success: false,
            totalRequested: items.length,
            totalCreated: 0,
            totalSkipped: 0,
            totalFailed: failedInput.length,
            created: [],
            skipped: [],
            failed: failedInput.map((item) => ({
              title: item.title,
              sourceUrl: item.sourceUrl,
              reason: item.reason,
            })),
            error: {
              code: "invalid_archive_input",
              message: `${failedInput.length}/${items.length} 条稿件未通过入库校验,未执行任何入库动作`,
            },
          };
        }

        // dryRun 短路必须在所有 DB 操作之前 —— 跟 cms_publish 一致，
        // 防止测试入口污染 articles 表。
        if (dryRun) {
          const dryRunCreated = validItems.map((item, index) => {
            const articleId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
            return {
              articleId,
              title: item.title,
              sourceUrl: item.sourceUrl,
              status: "created" as const,
            };
          });
          return {
            success: true,
            dryRun: true,
            totalRequested: items.length,
            totalCreated: dryRunCreated.length,
            totalSkipped: 0,
            totalFailed: failedInput.length,
            totalAvailable: dryRunCreated.length,
            wouldInsert: dryRunCreated.length,
            wouldDedupBy: dedupBySourceUrl ? "sourceUrl" : "off",
            firstArticleId: dryRunCreated[0]?.articleId ?? null,
            firstTitle: dryRunCreated[0]?.title ?? null,
            created: dryRunCreated,
            inserted: dryRunCreated,
            articles: dryRunCreated,
            skipped: [],
            failed: failedInput.map((item) => ({
              title: item.title,
              sourceUrl: item.sourceUrl,
              reason: item.reason,
            })),
            ...(failedInput.length > 0
              ? {
                  warning: {
                    code: "partial_invalid_archive_input",
                    message: `${failedInput.length}/${items.length} 条稿件未通过入库校验,dry-run 已跳过坏稿并模拟其余有效稿件`,
                  },
                }
              : {}),
            note: "dry-run: 实际跑会按 sourceUrl 去重后写入 articles 表",
          };
        }
        if (!organizationId) {
          return {
            success: false,
            error: { code: "missing_context", message: "缺少 organizationId" },
          };
        }

        const { db } = await import("@/db");
        const { articles } = await import("@/db/schema/articles");
        const { and, eq } = await import("drizzle-orm");

        const inserted: {
          articleId: string;
          title: string;
          sourceUrl?: string;
          status: "created";
        }[] = [];
        const available: {
          articleId: string;
          title: string;
          sourceUrl?: string;
          status: "created" | "existing";
        }[] = [];
        const availableArticleIds = new Set<string>();
        const pushAvailable = (item: (typeof available)[number]) => {
          if (availableArticleIds.has(item.articleId)) return;
          availableArticleIds.add(item.articleId);
          available.push(item);
        };
        const skipped: {
          sourceUrl: string;
          existingArticleId: string;
          title: string;
          reason: string;
        }[] = [];

        for (const item of validItems) {
          if (dedupBySourceUrl && item.sourceUrl) {
            const exists = await db.query.articles.findFirst({
              where: and(
                eq(articles.organizationId, organizationId),
                eq(articles.sourceUrl, item.sourceUrl),
              ),
              columns: { id: true, title: true, missionId: true },
            });
            if (exists) {
              if (missionId && !exists.missionId) {
                await db
                  .update(articles)
                  .set({ missionId })
                  .where(eq(articles.id, exists.id));
              }
              skipped.push({
                sourceUrl: item.sourceUrl,
                existingArticleId: exists.id,
                title: exists.title,
                reason: "duplicate_source_url",
              });
              pushAvailable({
                articleId: exists.id,
                title: exists.title,
                sourceUrl: item.sourceUrl,
                status: "existing",
              });
              continue;
            }
          }
          const [row] = await db.insert(articles).values({
            organizationId,
            title: item.title,
            body: item.body,
            // 历史 bug：此前漏写 wordCount → 全库稿件 word_count=0，稿件库看着像空稿
            // （正文其实都在 body 里）。统一在工具层从 body 计算，一处修复所有调用方
            // （content-loop / mission / 跨语言搬运）。中文「字数」即字符数，与初稿卡口径一致。
            wordCount: item.body?.length ?? 0,
            summary: item.summary ?? null,
            sourceUrl: item.sourceUrl ?? null,
            missionId: missionId ?? null,
            status: initialStatus,
            tags: [...(item.tags ?? []), ...(item.hashtags ?? [])],
            mediaType: "article",
            publishedAt: null,
            language: item.language ?? "en",
            metadata: {
              sourceTopicId: item.sourceTopicId,
              variantIndex: item.variantIndex,
              language: item.language ?? "en",
              category: item.category,
              culturalNotes: item.culturalNotes,
              workflowTaskId: taskId,
              // 渠道产出（IM 对话）标 false：createdByWorkflow 语义是"多步 mission 产出"
              createdByWorkflow: !ingestedFromChannel,
              ...(ingestedFromChannel ? { ingestedFromChannel } : {}),
            },
          }).returning({ id: articles.id, title: articles.title });

          const ref = {
            articleId: row.id,
            title: row.title,
            sourceUrl: item.sourceUrl,
            status: "created" as const,
          };
          inserted.push(ref);
          pushAvailable(ref);
        }
        void operatorId;
        return {
          success: true,
          totalRequested: items.length,
          totalCreated: inserted.length,
          totalSkipped: skipped.length,
          totalFailed: failedInput.length,
          totalAvailable: available.length,
          // ─── 顶层便利字段：方便单文章串联场景 {{stepN.firstArticleId}}（dot path 也可，但顶层更直观）─
          firstArticleId: available[0]?.articleId ?? null,
          firstTitle: available[0]?.title ?? null,
          // created 保持为下游兼容字段：CMS 批量发布步骤常绑定 {{stepN.created}}。
          // 这里返回“本次确保已在稿件库可用”的稿件，包含新建和按 sourceUrl 命中的已有稿件；
          // 精确的新建行数看 totalCreated，精确的新建列表看 inserted。
          created: available,
          inserted,
          articles: available,
          skipped,
          failed: failedInput.map((item) => ({
            title: item.title,
            sourceUrl: item.sourceUrl,
            reason: item.reason,
          })),
          ...(failedInput.length > 0
            ? {
                warning: {
                  code: "partial_invalid_archive_input",
                  message: `${failedInput.length}/${items.length} 条稿件未通过入库校验,已跳过坏稿并入库其余有效稿件`,
                },
              }
            : {}),
        };
      },
    }),

    // ─── 新闻 URL 导入闭环 复用能力 (2026-06-26) ───
    // 实现都在 lib/articles/* 与 lib/tingwu/*，这里只做薄暴露层供对话里 LLM 自主调用。
    video_extract: tool({
      description:
        "从一个网页/视频链接抽取可下载的视频源（og:video / 直链 mp4 / 平台识别）。" +
        "返回视频直链、封面、是否流媒体(m3u8)、识别到的平台。用于判断一条链接是否含视频、拿到视频地址。",
      inputSchema: z.object({
        url: z.string().describe("网页或视频页面 URL"),
      }),
      execute: async ({ url }) => {
        try {
          const { detectVideoSource } = await import("@/lib/articles/video-source");
          const vs = await detectVideoSource(url);
          return {
            success: true,
            kind: vs.kind,
            videoUrl: vs.videoUrl,
            thumbnailUrl: vs.thumbnailUrl,
            platform: vs.platform,
          };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
    analyze_article: tool({
      description:
        "对一段稿件正文做结构化分析提炼：返回 摘要/分类/标签/核心要点。" +
        "用于'帮我分析/提炼这篇文章'。只返回结果不写库。",
      inputSchema: z.object({
        title: z.string().describe("文章标题"),
        body: z.string().describe("文章正文"),
        categories: z.array(z.string()).optional().describe("候选分类名（可选）"),
      }),
      execute: async ({ title, body, categories }) => {
        try {
          const { analyzeArticleStructured } = await import("@/lib/articles/analyze");
          const digest = await analyzeArticleStructured({ title, body, categories });
          return { success: true, ...digest };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
        }
      },
    }),
    tingwu_analyze: tool({
      description:
        "对一个素材库视频调用通义听悟做转写/摘要/章节理解。异步任务：仅触发并立即返回 jobId，" +
        "完成后结果自动回填素材库与稿件，不阻塞对话。需素材已入库(assetId)且有公网可访问视频直链(publicUrl)。",
      inputSchema: z.object({
        assetId: z.string().describe("素材库视频 assetId"),
        publicUrl: z.string().describe("视频的公网可访问直链"),
        articleId: z.string().optional().describe("关联稿件 id（可选）"),
        organizationId: z.string().optional(),
      }),
      execute: async ({ assetId, publicUrl, articleId, organizationId }) => {
        try {
          const { isTingwuEnabled } = await import("@/lib/tingwu/config");
          if (!isTingwuEnabled()) {
            return { success: false, error: "通义听悟未配置（VIDEO_ANALYSIS_PROVIDER + 阿里云凭证）" };
          }
          if (!organizationId) {
            return { success: false, error: "缺少 organizationId（执行器未注入）" };
          }
          const { inngest } = await import("@/inngest/client");
          await inngest.send({
            name: "media/tingwu-analyze.requested",
            data: { organizationId, assetId, articleId, publicUrl },
          });
          return {
            success: true,
            status: "submitted",
            assetId,
            message: "已提交通义听悟分析，完成后自动回填素材库与稿件",
          };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : String(err) };
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

/**
 * 写入型工具白名单 —— 调用这些工具会产生 DB / 外部 API 副作用。
 * 用于：skill 测试入口（自动注入 dryRun=true 防污染）、未来 mission 预执行
 * 阶段的安全检查、UI 警示等。
 *
 * 每个工具都必须在自己的 inputSchema 里支持 `dryRun: z.boolean().optional()`，
 * 并在 execute 入口先于任何副作用短路 return。
 */
export const WRITE_TOOL_NAMES = new Set<string>([
  "cms_publish",
  "cms_batch_publish",
  "archive_to_drafts",  // 海外热榜搬运 / 跨语言改写场景：只入本地 articles 表
  "cms_catalog_sync",   // 当前未注册，预留
  "external_publish",   // 当前未注册，预留
]);

export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOL_NAMES.has(toolName);
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
    missionId?: string;
    taskId?: string;
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
  if (context?.missionId && rawWithContext.missionId === undefined) {
    rawWithContext.missionId = context.missionId;
  }
  if (context?.taskId && rawWithContext.taskId === undefined) {
    rawWithContext.taskId = context.taskId;
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
        const { eq: _eq } = await import("drizzle-orm");

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
      const { inArray: _inArray } = await import("drizzle-orm");

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

// ---------------------------------------------------------------------------
// xiaoyan / xiaolei chat tools — research_query_builder (+ data_pivoter Phase 4)
// orgId-scoped — injected at chat-stream time, not in static ALL_TOOLS.
// 与 createMissionTools / createKnowledgeBaseTools 同模式（lazy factory）。
// ---------------------------------------------------------------------------

export function createXiaoyanChatTools(context: {
  organizationId: string;
  employeeSlug?: string;
}): ToolSet {
  // 路由表（与 spec §3.2 compatibleRoles 一致）：
  // - research_query_builder：xiaoyan + xiaolei（research_analyst + trending_scout）
  // - data_pivoter：xiaoyan + xiaoshu（research_analyst + data_analyst）
  // 其他 employee 返回空集
  const allowsResearchQuery =
    !context.employeeSlug ||
    context.employeeSlug === "xiaoyan" ||
    context.employeeSlug === "xiaolei";
  const allowsDataPivoter =
    !context.employeeSlug ||
    context.employeeSlug === "xiaoyan" ||
    context.employeeSlug === "xiaoshu";

  if (!allowsResearchQuery && !allowsDataPivoter) {
    return {};
  }

  const tools: ToolSet = {};

  if (allowsResearchQuery) {
    // 动态 import 避免循环依赖（skill file → assembly.ts → tool-registry.ts）
    const {
      createResearchQueryBuilderTool,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
    } = require("./skills/research-query-builder") as typeof import("./skills/research-query-builder");
    tools.research_query_builder = createResearchQueryBuilderTool(
      context.organizationId,
    );
  }

  if (allowsDataPivoter) {
    const {
      createDataPivoterTool,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
    } = require("./skills/data-pivoter") as typeof import("./skills/data-pivoter");
    tools.data_pivoter = createDataPivoterTool(context.organizationId);
  }

  return tools;
}

/**
 * LLM agent 路径下，AI SDK 触发 tool_call 时**没有 server-side 调用方**可以把
 * organizationId / operatorId 注入 args —— 走 `toVercelTools` 的工具需要 context 注入。
 *
 * 跟 `invokeToolDirectly` 的 context 字段保持一致；未被对应工具 schema 消费的字段
 * 会被 zod 自动忽略，所以不会污染不需要 orgId 的工具（web_search 等）。
 */
export interface ToolContext {
  organizationId?: string;
  operatorId?: string;
  missionId?: string;
  taskId?: string;
  /** cowork 会话 id — 注入后 CLI async execute 可把 conversationId 写入 run 行
   * 与 cli/run.requested 事件，surfaceCliOutput 据此生成 cowork import_card。 */
  conversationId?: string;
  /** 领域权威源 → 注入 web_search 的 includeDomains（仅对有该入参的工具生效）。 */
  authorityDomains?: string[];
}

/**
 * 把 tool.execute 包一层，调用时把 context 字段合并进 args。
 * - context 为空 / 全 undefined → 直接返回原 toolDef（保持向后兼容、不破坏 AI SDK 引用相等检查）
 * - execute 不是函数 → 原样返回（placeholder tool 已经定义 execute；但 defensive）
 * - 显式 args.{field} 优先于 context.{field}（与 invokeToolDirectly 行为一致）
 */
function wrapToolExecuteWithContext<T extends { execute?: unknown }>(
  toolDef: T,
  context?: ToolContext,
): T {
  if (
    !context ||
    (!context.organizationId && !context.operatorId && !context.missionId && !context.taskId && !context.conversationId && !context.authorityDomains?.length)
  ) {
    return toolDef;
  }
  const orig = toolDef.execute;
  if (typeof orig !== "function") return toolDef;
  return {
    ...toolDef,
    execute: async (args: Record<string, unknown>, ...rest: unknown[]) => {
      const merged: Record<string, unknown> = { ...args };
      if (context.organizationId && merged.organizationId === undefined) {
        merged.organizationId = context.organizationId;
      }
      if (context.operatorId && merged.operatorId === undefined) {
        merged.operatorId = context.operatorId;
      }
      if (context.missionId && merged.missionId === undefined) {
        merged.missionId = context.missionId;
      }
      if (context.taskId && merged.taskId === undefined) {
        merged.taskId = context.taskId;
      }
      if (context.conversationId && merged.conversationId === undefined) {
        merged.conversationId = context.conversationId;
      }
      if (context.authorityDomains?.length && merged.includeDomains === undefined) {
        merged.includeDomains = context.authorityDomains;
      }
      return (orig as (a: Record<string, unknown>, ...r: unknown[]) => unknown)(
        merged,
        ...rest,
      );
    },
  } as T;
}

export function toVercelTools(
  agentTools: AgentTool[],
  pluginConfigs?: Map<string, { description: string; config: PluginConfig }>,
  missionTools?: ToolSet,
  knowledgeBaseTools?: ToolSet,
  context?: ToolContext,
  mcpTools?: ToolSet,
  cliTools?: ToolSet,
): ToolSet {
  const result: ToolSet = {};

  for (const t of agentTools) {
    if (ALL_TOOLS[t.name]) {
      result[t.name] = wrapToolExecuteWithContext(ALL_TOOLS[t.name], context);
    } else if (pluginConfigs?.has(t.name)) {
      const plugin = pluginConfigs.get(t.name)!;
      result[t.name] = wrapToolExecuteWithContext(
        createPluginTool(t.name, plugin.description, plugin.config),
        context,
      );
    } else {
      result[t.name] = wrapToolExecuteWithContext(
        tool({
          description: t.description,
          inputSchema: z.object({
            input: z.string().optional().describe("任务输入"),
          }),
          execute: async ({ input }) => ({
            result: `[${t.name}] 已完成处理${input ? `:${input}` : ""}`,
          }),
        }),
        context,
      );
    }
  }

  // Merge mission collaboration tools if provided
  if (missionTools) {
    for (const [name, def] of Object.entries(missionTools)) {
      result[name] = wrapToolExecuteWithContext(
        def as { execute?: unknown },
        context,
      ) as ToolSet[string];
    }
  }

  // Merge knowledge base retrieval tools if provided
  if (knowledgeBaseTools) {
    for (const [name, def] of Object.entries(knowledgeBaseTools)) {
      result[name] = wrapToolExecuteWithContext(
        def as { execute?: unknown },
        context,
      ) as ToolSet[string];
    }
  }

  // Merge MCP-derived tools if provided
  if (mcpTools) {
    for (const [name, def] of Object.entries(mcpTools)) {
      result[name] = wrapToolExecuteWithContext(
        def as { execute?: unknown },
        context,
      ) as ToolSet[string];
    }
  }

  // Merge CLI-derived tools if provided (M3.6 — plain in-process ToolSet, no close)
  if (cliTools) {
    for (const [name, def] of Object.entries(cliTools)) {
      result[name] = wrapToolExecuteWithContext(
        def as { execute?: unknown },
        context,
      ) as ToolSet[string];
    }
  }

  return result;
}
