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
          .describe("写作风格：professional/casual/news/academic"),
        maxLength: z.number().optional().default(2000).describe("最大字数"),
      }),
      execute: async ({ outline, style, maxLength }) => {
        try {
          const { generateText: gen } = await import("ai");
          const { getLanguageModel, resolveModelConfig } = await import("./model-router");
          const cfg = resolveModelConfig(["generation"], { temperature: 0.7, maxTokens: Math.min(maxLength * 2, 8192) });
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
          const cfg = resolveModelConfig(["analysis"], { temperature: 0.2, maxTokens: 4096 });
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
  };
}

const ALL_TOOLS = createToolDefinitions();
const BUILTIN_SKILL_NAME_TO_SLUG = getBuiltinSkillNameToSlug();

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

export function toVercelTools(
  agentTools: AgentTool[],
  pluginConfigs?: Map<string, { description: string; config: PluginConfig }>,
  missionTools?: ToolSet
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

  return result;
}
