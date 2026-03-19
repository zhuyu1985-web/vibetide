# 全网搜索技能深化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将"全网搜索"技能从单一 RSS 抓取升级为 3 个工具协同的全网信息获取系统（web_search 增强 + web_deep_read 新增 + trending_topics 新增）。

**Architecture:** 在 `tool-registry.ts` 中实现 3 个工具的完整逻辑，每个工具都有主通道（第三方 API）和降级通道（RSS/cheerio）。通过环境变量控制 API 接入，无 Key 时自动降级。更新 SKILL.md 文档、常量定义和环境变量模板。

**Tech Stack:** Tavily Search API, Jina Reader API, 可配置热榜 API, cheerio (HTML 解析降级), Vercel AI SDK tool format

---

### Task 1: 安装 cheerio 依赖

**Files:**
- Modify: `package.json`

**Step 1: 安装 cheerio**

```bash
npm install cheerio
```

**Step 2: 验证安装**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: 无 cheerio 相关报错

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add cheerio dependency for web_deep_read fallback"
```

---

### Task 2: 添加环境变量模板

**Files:**
- Modify: `.env.example`

**Step 1: 在 `.env.example` 的 AI SDK 区块后添加**

在 `OPENAI_API_KEY=sk-...` 行之后添加：

```env
# Web Search Enhancement
TAVILY_API_KEY=tvly-...           # Tavily Search API (全网搜索主通道)
JINA_API_KEY=jina_...             # Jina Reader API (网页深读主通道)

# Trending Topics (可配置热榜聚合 API)
TRENDING_API_URL=                 # 热榜 API 地址，如 https://api.tophub.today/...
TRENDING_API_KEY=                 # 热榜 API 密钥
TRENDING_RESPONSE_MAPPING=        # JSON 格式响应映射，如 {"dataPath":"data","fields":{"platform":"source","rank":"rank","title":"title","heat":"heat","url":"url","category":"category"}}
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add env vars for Tavily, Jina Reader, and trending API"
```

---

### Task 3: 更新 constants.ts — EMPLOYEE_CORE_SKILLS 和 READ_ONLY_TOOL_NAMES

**Files:**
- Modify: `src/lib/constants.ts:574-591`

**Step 1: 更新 EMPLOYEE_CORE_SKILLS**

在 `src/lib/constants.ts:575` 小雷的技能列表中添加 `web_deep_read` 和 `trending_topics`：

```typescript
// 修改前
xiaolei: ["web_search", "trend_monitor", "social_listening", "heat_scoring"],
xiaoce: ["topic_extraction", "angle_design", "audience_analysis", "task_planning"],

// 修改后
xiaolei: ["web_search", "web_deep_read", "trending_topics", "trend_monitor", "social_listening", "heat_scoring"],
xiaoce: ["web_search", "web_deep_read", "trending_topics", "topic_extraction", "angle_design", "audience_analysis", "task_planning"],
```

**Step 2: 更新 READ_ONLY_TOOL_NAMES**

在 `src/lib/constants.ts:586-591` 添加两个新工具名：

```typescript
// 修改前
export const READ_ONLY_TOOL_NAMES = [
  "web_search", "trend_monitor", "social_listening", "news_aggregation",
  "knowledge_retrieval", "media_search", "case_reference", "data_report",
  "sentiment_analysis", "topic_extraction", "competitor_analysis",
  "audience_analysis", "fact_check", "heat_scoring",
] as const;

// 修改后
export const READ_ONLY_TOOL_NAMES = [
  "web_search", "web_deep_read", "trending_topics",
  "trend_monitor", "social_listening", "news_aggregation",
  "knowledge_retrieval", "media_search", "case_reference", "data_report",
  "sentiment_analysis", "topic_extraction", "competitor_analysis",
  "audience_analysis", "fact_check", "heat_scoring",
] as const;
```

**Step 3: 更新 TOOL_DESCRIPTIONS**

在 `src/lib/constants.ts:594` 的 `TOOL_DESCRIPTIONS` 对象中添加：

```typescript
web_deep_read: "抓取网页正文进行深度分析",
trending_topics: "聚合多平台实时热榜",
```

**Step 4: 类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add web_deep_read and trending_topics to employee skills and read-only tools"
```

---

### Task 4: 更新 constants.ts — BUILTIN_SKILLS 新增两个技能定义

**Files:**
- Modify: `src/lib/constants.ts:203-213`

**Step 1: 在 BUILTIN_SKILLS 数组的 web_search 条目之后添加两个新条目**

在 `src/lib/constants.ts` 的 `BUILTIN_SKILLS` 数组中，紧接 `web_search` 条目（约第 213 行的 `},` 之后），插入：

```typescript
  {
    slug: "web_deep_read", name: "网页深读", category: "perception", version: "1.0",
    description: "抓取指定网页正文并提取结构化内容，用于深度分析",
    content: "# 网页深读\n\n你是网页内容提取专家，能够从指定URL抓取网页正文并输出干净的结构化内容。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| url | string | 是 | 要深读的网页URL |\n| maxLength | number | 否 | 正文截断字数，默认3000 |\n\n## 执行流程\n1. **URL验证**：检查URL格式合法性\n2. **正文抓取**：通过Jina Reader API或直接fetch获取网页内容\n3. **内容提取**：提取标题、正文、发布时间等关键信息\n4. **格式清洗**：去除广告、导航等无关内容，输出干净Markdown\n5. **长度控制**：按maxLength截断，保留完整段落\n\n## 输出规格\n```markdown\n## 网页深读结果\n- 标题：{title}\n- 来源：{domain}\n- 字数：{wordCount}\n- 抓取时间：{extractedAt}\n\n### 正文内容\n{content}\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 提取准确性 | 正文内容完整无遗漏 | 40% |\n| 格式清洁度 | 无广告、导航等噪音 | 30% |\n| 结构保留 | 保留标题层级和段落结构 | 30% |",
    inputSchema: { url: "网页URL", maxLength: "正文截断字数" },
    outputSchema: { title: "页面标题", content: "提取的正文", wordCount: "字数", source: "来源域名" },
    runtimeConfig: { type: "api_call", avgLatencyMs: 5000, maxConcurrency: 3 },
    compatibleRoles: ["trending_scout", "content_strategist"],
  },
  {
    slug: "trending_topics", name: "热榜聚合", category: "perception", version: "1.0",
    description: "聚合多平台实时热榜，主动发现全网热点话题",
    content: "# 热榜聚合\n\n你是全网热点聚合专家，能够实时获取各大平台热搜/热榜数据并进行跨平台分析。\n\n## 输入规格\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| platforms | string[] | 否 | 过滤平台：weibo/zhihu/baidu/douyin/36kr，默认全部 |\n| limit | number | 否 | 每个平台返回条数，默认20 |\n\n## 执行流程\n1. **数据获取**：从配置的热榜聚合API实时拉取各平台热搜数据\n2. **格式归一化**：将不同平台的数据映射为统一结构\n3. **跨平台聚合**：识别跨平台同话题，合并热度\n4. **排序输出**：按综合热度排序，标注跨平台覆盖情况\n\n## 输出规格\n```markdown\n## 热榜聚合报告\n**抓取时间**: {fetchedAt} | **覆盖平台**: {platforms}\n\n### 跨平台热点（多平台同时上榜）\n| 话题 | 覆盖平台 | 综合热度 | 是否已验证 |\n\n### 各平台热榜\n#### {platform}\n| 排名 | 话题 | 热度 | 链接 |\n```\n\n## 质量标准\n| 维度 | 要求 | 权重 |\n|------|------|------|\n| 实时性 | 数据延迟<5分钟 | 35% |\n| 覆盖度 | 主流平台均有数据 | 30% |\n| 聚合准确 | 跨平台话题匹配正确 | 35% |",
    inputSchema: { platforms: "平台过滤", limit: "每平台返回条数" },
    outputSchema: { topics: "热榜数据", crossPlatformTopics: "跨平台聚合", fetchedAt: "抓取时间" },
    runtimeConfig: { type: "api_call", avgLatencyMs: 3000, maxConcurrency: 3 },
    compatibleRoles: ["trending_scout", "content_strategist"],
  },
```

**Step 2: 类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: add web_deep_read and trending_topics builtin skill definitions"
```

---

### Task 5: 增强 web_search 工具 — Tavily 主通道 + RSS 降级

**Files:**
- Modify: `src/lib/agent/tool-registry.ts:369-446`

**Step 1: 在文件顶部（import 区域之后，约第 8 行后）添加 Tavily 相关类型和函数**

```typescript
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

    // Tavily days mapping
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
      headers: {
        "Content-Type": "application/json",
      },
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
        engine: "google-news" as const, // reuse type for compatibility
        sourceType,
        credibility: inferCredibility(sourceType),
      };
    });

    return {
      items,
      answer: data.answer,
      responseTime: data.response_time,
    };
  } finally {
    clearTimeout(timeout);
  }
}
```

**Step 2: 替换 web_search 工具的 execute 函数体**

替换 `src/lib/agent/tool-registry.ts` 中 `web_search` 工具的 `inputSchema` 和 `execute`（约第 371-445 行）：

```typescript
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
            // Fall through to RSS
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
```

**Step 3: 类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/agent/tool-registry.ts
git commit -m "feat: enhance web_search with Tavily primary channel and RSS fallback"
```

---

### Task 6: 新增 web_deep_read 工具

**Files:**
- Modify: `src/lib/agent/tool-registry.ts`

**Step 1: 在文件顶部添加 cheerio import**

在第 1 行附近的 import 区域添加：

```typescript
import * as cheerio from "cheerio";
```

**Step 2: 在 Tavily helpers 之后添加 Jina Reader 和 cheerio 降级函数**

```typescript
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
  // Try to cut at paragraph boundary
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
```

**Step 3: 在 `createToolDefinitions()` 函数中，`content_generate` 工具之前（约第 447 行），添加 `web_deep_read` 工具**

```typescript
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
            // Fall through to cheerio
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
```

**Step 4: 类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/agent/tool-registry.ts
git commit -m "feat: add web_deep_read tool with Jina Reader primary and cheerio fallback"
```

---

### Task 7: 新增 trending_topics 工具

**Files:**
- Modify: `src/lib/agent/tool-registry.ts`

**Step 1: 在 Web Deep Read helpers 之后添加 trending_topics helpers**

```typescript
// ---------------------------------------------------------------------------
// Trending Topics helpers
// ---------------------------------------------------------------------------

interface TrendingResponseMapping {
  dataPath: string;
  fields: {
    platform: string;
    rank: string;
    title: string;
    heat: string;
    url: string;
    category?: string;
  };
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

function extractByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function mapTrendingResponse(data: unknown, mapping: TrendingResponseMapping): TrendingItem[] {
  const items = extractByPath(data, mapping.dataPath);
  if (!Array.isArray(items)) return [];

  return items.map((item: unknown, index: number) => {
    const record = item as Record<string, unknown>;
    const fields = mapping.fields;
    return {
      platform: String(extractByPath(record, fields.platform) ?? "unknown"),
      rank: Number(extractByPath(record, fields.rank) ?? index + 1),
      title: String(extractByPath(record, fields.title) ?? ""),
      heat: (extractByPath(record, fields.heat) as number | string) ?? 0,
      url: String(extractByPath(record, fields.url) ?? ""),
      category: fields.category ? String(extractByPath(record, fields.category) ?? "") : undefined,
    };
  }).filter((item) => item.title.length > 0);
}

async function fetchTrendingFromApi(
  platforms?: string[],
  limit?: number
): Promise<TrendingItem[]> {
  const apiUrl = process.env.TRENDING_API_URL;
  const apiKey = process.env.TRENDING_API_KEY;
  const mapping = parseTrendingMapping();

  if (!apiUrl) throw new Error("TRENDING_API_URL not configured");
  if (!mapping) throw new Error("TRENDING_RESPONSE_MAPPING not configured or invalid JSON");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const url = new URL(apiUrl);
    if (platforms && platforms.length > 0) {
      url.searchParams.set("platforms", platforms.join(","));
    }
    if (limit) {
      url.searchParams.set("limit", String(limit));
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Trending API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return mapTrendingResponse(data, mapping);
  } finally {
    clearTimeout(timeout);
  }
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
    // Simple title normalization for matching
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
      verified: false, // Agent can verify via web_search
    }));
}
```

**Step 2: 在 `createToolDefinitions()` 中，`web_deep_read` 工具之后添加 `trending_topics` 工具**

```typescript
    trending_topics: tool({
      description: "聚合多平台实时热榜（微博/知乎/百度/抖音/36氪等），发现全网热点话题",
      inputSchema: z.object({
        platforms: z
          .array(z.string())
          .optional()
          .describe("过滤平台：weibo/zhihu/baidu/douyin/36kr，默认全部"),
        limit: z
          .number()
          .optional()
          .default(20)
          .describe("每个平台返回条数，默认 20"),
      }),
      execute: async ({ platforms, limit = 20 }) => {
        const warnings: string[] = [];
        let items: TrendingItem[] = [];

        // Primary: configured API
        if (process.env.TRENDING_API_URL) {
          try {
            items = await fetchTrendingFromApi(platforms, limit);
          } catch (err) {
            warnings.push(
              `热榜 API 失败: ${err instanceof Error ? err.message : String(err)}`
            );
          }
        } else {
          warnings.push("未配置 TRENDING_API_URL，无法获取实时热榜数据");
        }

        if (items.length === 0 && warnings.length > 0) {
          return {
            fetchedAt: new Date().toISOString(),
            platforms: platforms ?? [],
            topics: [],
            crossPlatformTopics: [],
            warnings,
          };
        }

        // Filter by platforms if specified
        const filteredItems = platforms && platforms.length > 0
          ? items.filter((item) =>
              platforms.some((p) => item.platform.toLowerCase().includes(p.toLowerCase()))
            )
          : items;

        const crossPlatformTopics = buildCrossPlatformTopics(filteredItems);
        const activePlatforms = Array.from(new Set(filteredItems.map((i) => i.platform)));

        return {
          fetchedAt: new Date().toISOString(),
          platforms: activePlatforms,
          topics: filteredItems.slice(0, limit * activePlatforms.length),
          crossPlatformTopics,
          warnings,
        };
      },
    }),
```

**Step 3: 类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/agent/tool-registry.ts
git commit -m "feat: add trending_topics tool with configurable API and cross-platform aggregation"
```

---

### Task 8: 更新 SKILL.md 文档

**Files:**
- Modify: `skills/web_search/SKILL.md`

**Step 1: 替换整个 SKILL.md 内容**

```markdown
---
name: web_search
description: "全网信息获取系统：精准搜索 + 网页深读 + 热榜聚合"
---

# 全网搜索

你是面向新闻策划、热点追踪、素材收集场景的实时信息检索专家。你拥有三个核心工具，能够完成"搜索 → 验证 → 深读"的完整信息获取链路。

## 工具清单

| 工具 | 用途 | 何时使用 |
|------|------|----------|
| `web_search` | 全网精准搜索 | 需要搜索特定话题的最新信息时 |
| `web_deep_read` | 网页正文深读 | 需要深入分析某篇文章内容时 |
| `trending_topics` | 热榜主动发现 | 需要了解当前全网热点时 |

## 核心能力

1. **实时检索**：通过 Tavily API 搜索全网最新内容（降级为 RSS 聚合）
2. **热榜聚合**：从多平台实时热榜主动发现热点话题
3. **正文深读**：对重要搜索结果抓取正文做深度分析
4. **交叉验证**：热榜话题可通过搜索验证真实性，过滤营销水军
5. **来源分级**：央媒/官方 > 行业媒体 > 新闻媒体 > 社交/社区
6. **优雅降级**：每个工具在无 API Key 时自动降级，不会中断工作

## 典型工作流

### 场景 1：热点发现 + 深度分析

```
1. trending_topics → 获取各平台实时热榜
2. 从热榜中筛选有价值的话题
3. web_search "话题关键词" → 搜索相关新闻，交叉验证热点真实性
4. web_deep_read 重要文章 URL → 深读 top 2-3 篇核心文章
5. 综合输出：热点分析报告（热度、多源验证、核心观点）
```

### 场景 2：定向话题追踪

```
1. web_search "指定话题" → 获取最新动态和多方观点
2. web_deep_read 关键结果 → 深读重要文章提取详细信息
3. 输出：话题追踪报告（最新进展、各方观点、事实依据）
```

### 场景 3：快速热点扫描

```
1. trending_topics → 获取当前热榜
2. 直接输出：热点速览（跨平台热点 + 各平台 Top 10）
```

## 工具 1：web_search

### 输入规格

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索查询词、自然语言问题或主题方向 |
| timeRange | string | 否 | 时间范围：1h / 24h / 7d / 30d / all，默认 24h |
| sources | string[] | 否 | 来源过滤，如：央媒、官方、行业媒体、新闻媒体、社交 |
| maxResults | number | 否 | 返回结果数，默认 8，最大 20 |
| topic | string | 否 | 搜索类型：general / news / finance（仅 Tavily 通道） |

### 执行流程

1. **意图识别**：判断用户是在找"最新动态""热点聚类"还是"某一主题的实时情报"
2. **多源检索**：优先通过 Tavily API 全网搜索；若不可用，回退到 Google/Bing News RSS
3. **结果去重与清洗**：对标题、链接、来源进行去重，清洗广告和低质量结果
4. **可信度排序**：综合来源权威性、关键词匹配度、时效性排序
5. **热点聚类**：从高频出现的标题中提炼热点主题
6. **结构化输出**：摘要 + 热点 + 结果列表 + 告警

### 输出结构

```markdown
## 全网搜索摘要
- 查询：{query}
- 检索时间：{generatedAt}
- 通道：{tavily/rss}
- 结果数：{returnedCount}
- 核心结论：{summary}

## 热点话题
1. **{topic}**
   - 热度级别：{high/medium/observed}
   - 代表标题：{representativeTitle}
   - 关联来源：{source1}、{source2}

## 详细结果
### 1. {title}
- 来源：{source}（{sourceType} / {credibility}）
- 发布时间：{publishedAt}
- 摘要：{snippet}
- 链接：{url}

## 告警 / 备注
- {warnings}
```

## 工具 2：web_deep_read

### 输入规格

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 要深读的网页 URL |
| maxLength | number | 否 | 正文截断字数，默认 3000 |

### 执行流程

1. **URL 验证**：检查格式合法性
2. **正文抓取**：优先 Jina Reader API（返回干净 Markdown）；若不可用，回退到直接 fetch + cheerio 提取
3. **内容清洗**：去除广告、导航等噪音元素
4. **长度控制**：按 maxLength 截断，优先在段落或句子边界截断

### 输出结构

```markdown
## 网页深读结果
- 标题：{title}
- 来源：{source}
- 字数：{wordCount}
- 抓取时间：{extractedAt}

### 正文内容
{content}
```

### 使用建议

- 不要对所有搜索结果都调用深读，选择 top 2-3 条最重要的
- 对于需要提取具体数据或引用原文的场景使用
- 如果只需要了解大意，搜索结果的摘要已经足够

## 工具 3：trending_topics

### 输入规格

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platforms | string[] | 否 | 过滤平台：weibo/zhihu/baidu/douyin/36kr，默认全部 |
| limit | number | 否 | 每个平台返回条数，默认 20 |

### 执行流程

1. **数据获取**：从配置的热榜聚合 API 实时拉取各平台热搜数据
2. **格式归一化**：通过响应映射将不同服务商格式统一为标准结构
3. **跨平台聚合**：识别跨平台同话题，合并热度，多平台上榜 = 高置信度
4. **排序输出**：按综合热度排序，标注跨平台覆盖情况

### 输出结构

```markdown
## 热榜聚合报告
**抓取时间**: {fetchedAt} | **覆盖平台**: {platforms}

### 跨平台热点（多平台同时上榜）
| 话题 | 覆盖平台 | 综合热度 | 是否已验证 |

### 各平台热榜
#### {platform}
| 排名 | 话题 | 热度 | 链接 |
```

### 交叉验证

拿到热榜结果后，应对高热度话题调用 `web_search` 搜索验证：
- 有多家新闻媒体报道 → 标记为"已验证"
- 仅单平台热搜 + 无新闻佐证 → 标记为"待验证"（可能是营销话题）

## 质量标准

| 维度 | 要求 | 权重 |
|------|------|------|
| 时效性 | 优先返回最新结果，热榜数据延迟 < 5 分钟 | 25% |
| 相关性 | 搜索结果与查询意图高度匹配 | 25% |
| 来源质量 | 优先保留权威、主流、垂直优质来源 | 20% |
| 热点验证 | 热点话题有多源佐证，过滤营销水军 | 15% |
| 深度分析 | 深读内容提取完整、格式清洁 | 15% |

## 边界情况

- **查询词太泛**：自动扩展"最新/热点/进展"等变体，优先输出热点总览
- **结果过少**：放宽时间范围或取消来源过滤，明确提示覆盖不足
- **抓取失败/超时**：返回已成功获取的部分结果，将失败源写入 warnings
- **API 不可用**：自动降级到备用通道，不中断执行
- **正文过长**：按段落边界截断，标注"内容已截断"

## 上下游协作

**上游输入方：**
- 小雷（热点猎手）：提供热点关键词、突发主题、监控方向
- 小策（内容策划师）：提供选题方向、竞品问题、报道角度

**下游输出方：**
- 小雷（热点猎手）：用于判断是否值得继续追踪
- 小策（内容策划师）：用于沉淀选题背景、事实依据与角度
- 小资（素材管家）：用于收集优质来源与候选资料
```

**Step 2: Commit**

```bash
git add skills/web_search/SKILL.md
git commit -m "docs: update SKILL.md with 3-tool web search system documentation"
```

---

### Task 9: 验证构建

**Files:** (none modified)

**Step 1: 类型检查**

```bash
npx tsc --noEmit
```

Expected: PASS

**Step 2: 生产构建**

```bash
npm run build
```

Expected: PASS

**Step 3: 若有错误，修复后再次构建并 commit**

---

### Task 10: 最终 commit

**Step 1: 检查所有变更**

```bash
git status
git diff --stat HEAD~8
```

**Step 2: 确认无遗漏文件**

所有变更文件应包含：
- `package.json` + `package-lock.json`
- `.env.example`
- `src/lib/constants.ts`
- `src/lib/agent/tool-registry.ts`
- `skills/web_search/SKILL.md`
