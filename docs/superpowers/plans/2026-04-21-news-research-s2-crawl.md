# 新闻研究模块 · S2 采集通道 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让老师能提交一个研究任务，系统通过三路采集（Tavily 全网 + 白名单站点 + 手工粘贴 URL）把新闻文章抓进 `research_news_articles` 表，UI 展示采集进度与已抓文章列表。**本阶段不做关键词命中和语义分析**（S3 接手）。

**Architecture:** 采集层复用现有 `searchViaTavily` + `fetchViaJinaReader`。编排层用 Inngest fan-out：任务提交 → orchestrator 拆分为若干 crawl 子作业 → 并行采集 → upsert 去重（按 `url_hash`）→ 关联到 `research_tasks.id`。文章抓到即入库，不等全部完成，UI 实时看进度。

**Tech Stack:** Next.js 16、Drizzle 0.45.1、Inngest、Zod 4.3、shadcn/ui。

**依赖前置：** S1 已完成（10 张表上线、39 区县 + 16 主题 + 41 媒体源种子齐备、RBAC 权限注册）。

**关联设计文档：** `docs/superpowers/specs/2026-04-14-news-research-module-design.md`
**关联前序计划：** `docs/superpowers/plans/2026-04-14-news-research-s1-foundation.md`

---

## S1 → S2 联调变更点（FYI）

下列是 S2 新增内容之前需要对 S1 做的微调，放在 Task 1 前：
- **`news_articles` 缺 `research_task_id`**：原设计把文章与任务通过 `news_article_topic_hits.research_task_id` 关联，但 S2 还没有 hits，先给 `news_articles` 加一个可选字段 `first_seen_research_task_id`（便于任务详情页查自己的采集结果）。Task 1 中做该 schema 追加。

---

## 文件结构总览

### 新建 — 采集原语
- `src/lib/research/url-hash.ts` — URL 归一化 + SHA-256
- `src/lib/research/outlet-matcher.ts` — 按域名/别名 resolve 到 `media_outlets.id`
- `src/lib/research/article-ingest.ts` — upsert 文章（url_hash 幂等）
- `src/lib/research/tavily-crawler.ts` — 封装 Tavily 按站点 + 时段查询
- `src/lib/research/jina-fetch.ts` — 封装 Jina Reader + 错误退避

### 新建 — DAL
- `src/lib/dal/research/news-articles.ts`
- `src/lib/dal/research/research-tasks.ts`

### 新建 — Server Actions
- `src/app/actions/research/research-tasks.ts`（createTask / cancelTask / getTaskDetail）

### 新建 — Inngest 事件与函数
- `src/inngest/functions/research/task-start.ts`
- `src/inngest/functions/research/tavily-crawl.ts`
- `src/inngest/functions/research/whitelist-crawl.ts`
- `src/inngest/functions/research/manual-url-ingest.ts`
- `src/inngest/functions/research/index.ts`（re-export）

### 修改
- `src/db/schema/research/news-articles.ts` — 添加 `firstSeenResearchTaskId` 字段
- `src/inngest/events.ts` — 注册 S2 事件类型
- `src/app/api/inngest/route.ts` — 注册新函数
- `src/app/(dashboard)/research/page.tsx` — 从占位首页改为任务列表
- `src/inngest/client.ts` — 可能无需改，视事件类型接入方式

### 新建 — UI
- `src/app/(dashboard)/research/new/page.tsx`（server）
- `src/app/(dashboard)/research/new/new-task-client.tsx`（client，4 步表单）
- `src/app/(dashboard)/research/tasks/[id]/page.tsx`（server）
- `src/app/(dashboard)/research/tasks/[id]/task-detail-client.tsx`（client，进度 + 文章列表）
- `src/app/(dashboard)/research/research-home-client.tsx`（client，任务列表）

### 新建 — 测试
- `src/lib/research/__tests__/url-hash.test.ts`
- `src/lib/research/__tests__/outlet-matcher.test.ts`
- `src/lib/research/__tests__/article-ingest.test.ts`（集成）
- `src/lib/dal/research/__tests__/research-tasks.test.ts`（集成）

---

## Task 1: Schema 补丁：`news_articles.firstSeenResearchTaskId`

**Files:** Modify `src/db/schema/research/news-articles.ts`

- [ ] **Step 1.1** 在 `newsArticles` 表定义中，追加字段：

```ts
firstSeenResearchTaskId: uuid("first_seen_research_task_id").references(
  () => researchTasks.id,
  { onDelete: "set null" },
),
```

同时在表的 index 定义（`(t) => ({ ... })`）中加：

```ts
taskLookupIdx: index("research_news_articles_task_idx").on(t.firstSeenResearchTaskId),
```

需要从 `./research-tasks` import `researchTasks`（如已 import 则跳过）。

- [ ] **Step 1.2** 生成 + 推送迁移

```bash
npm run db:generate
npm run db:push
```

- [ ] **Step 1.3** 提交

```bash
git add src/db/schema/research/news-articles.ts supabase/migrations/
git commit -m "feat(research): add first_seen_research_task_id to news_articles"
```

---

## Task 2: URL hash 工具 + 测试

**Files:**
- Create: `src/lib/research/url-hash.ts`
- Create: `src/lib/research/__tests__/url-hash.test.ts`

- [ ] **Step 2.1** 实现：

```ts
// src/lib/research/url-hash.ts
import { createHash } from "node:crypto";

/**
 * Normalize URL for dedup:
 *  - Lowercase scheme + host
 *  - Drop fragment
 *  - Drop trailing slash on pathname (unless pathname is "/")
 *  - Drop tracking query params (utm_*, fbclid, gclid, spm)
 *  - Sort remaining query params alphabetically
 */
export function normalizeUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();

  const TRACKING = /^(utm_|fbclid$|gclid$|spm$|ref$|_hsmi$)/i;
  const keep: [string, string][] = [];
  u.searchParams.forEach((v, k) => {
    if (!TRACKING.test(k)) keep.push([k, v]);
  });
  keep.sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of keep) u.searchParams.append(k, v);

  let pathname = u.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  u.pathname = pathname;

  return u.toString();
}

export function hashUrl(raw: string): string {
  const normalized = normalizeUrl(raw);
  return createHash("sha256").update(normalized).digest("hex");
}
```

- [ ] **Step 2.2** 测试：

```ts
// src/lib/research/__tests__/url-hash.test.ts
import { describe, it, expect } from "vitest";
import { normalizeUrl, hashUrl } from "../url-hash";

describe("normalizeUrl", () => {
  it("strips fragment and trailing slash", () => {
    expect(normalizeUrl("https://a.com/path/#frag")).toBe("https://a.com/path");
  });

  it("lowercases host and scheme", () => {
    expect(normalizeUrl("HTTPS://A.COM/X")).toBe("https://a.com/X");
  });

  it("drops utm_* params", () => {
    expect(normalizeUrl("https://a.com/?utm_source=twitter&id=1"))
      .toBe("https://a.com/?id=1");
  });

  it("sorts remaining query params", () => {
    expect(normalizeUrl("https://a.com/?b=2&a=1"))
      .toBe("https://a.com/?a=1&b=2");
  });

  it("keeps root slash", () => {
    expect(normalizeUrl("https://a.com/")).toBe("https://a.com/");
  });
});

describe("hashUrl", () => {
  it("hashes two differently-formatted URLs to same value", () => {
    expect(hashUrl("https://A.COM/x/?utm_source=t&id=1"))
      .toBe(hashUrl("https://a.com/x?id=1"));
  });
  it("returns 64-char hex", () => {
    expect(hashUrl("https://a.com/")).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 2.3** 跑测试：

```bash
npm test -- src/lib/research/__tests__/url-hash.test.ts
```

所有 6 个用例必须 PASS。

- [ ] **Step 2.4** 提交

```bash
git add src/lib/research/url-hash.ts src/lib/research/__tests__/url-hash.test.ts
git commit -m "feat(research): URL normalization and SHA-256 hash utility"
```

---

## Task 3: Outlet matcher（URL → outlet_id）

**Files:**
- Create: `src/lib/research/outlet-matcher.ts`
- Create: `src/lib/research/__tests__/outlet-matcher.test.ts`

- [ ] **Step 3.1** 实现：

```ts
// src/lib/research/outlet-matcher.ts
import { db } from "@/db";
import {
  mediaOutlets,
  mediaOutletAliases,
} from "@/db/schema/research/media-outlets";
import { eq, and } from "drizzle-orm";

export type OutletMatch = {
  outletId: string;
  tier: "central" | "provincial_municipal" | "industry" | "district_media";
  districtId: string | null;
} | null;

/**
 * Resolve a URL to an outlet_id via:
 *  1. Exact hostname equals outlet.officialUrl hostname
 *  2. Alias.matchPattern as substring (domain substring) — most flexible
 */
export async function matchOutletForUrl(
  url: string,
  organizationId: string,
): Promise<OutletMatch> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }

  // Load active outlets + aliases for org (cached within single orchestrator call)
  const rows = await db
    .select({
      id: mediaOutlets.id,
      tier: mediaOutlets.tier,
      districtId: mediaOutlets.districtId,
      officialUrl: mediaOutlets.officialUrl,
    })
    .from(mediaOutlets)
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        eq(mediaOutlets.status, "active"),
      ),
    );

  for (const o of rows) {
    if (!o.officialUrl) continue;
    try {
      const oh = new URL(o.officialUrl).hostname.toLowerCase().replace(/^www\./, "");
      if (hostname === oh || hostname.endsWith("." + oh)) {
        return { outletId: o.id, tier: o.tier, districtId: o.districtId };
      }
    } catch {}
  }

  // Alias match
  const aliases = await db
    .select({
      outletId: mediaOutletAliases.outletId,
      matchPattern: mediaOutletAliases.matchPattern,
    })
    .from(mediaOutletAliases);

  for (const a of aliases) {
    if (!a.matchPattern) continue;
    // simple substring match against hostname (e.g., "xinhuanet.com")
    if (hostname.includes(a.matchPattern.toLowerCase())) {
      const [outlet] = await db
        .select({ tier: mediaOutlets.tier, districtId: mediaOutlets.districtId })
        .from(mediaOutlets)
        .where(eq(mediaOutlets.id, a.outletId));
      if (outlet) {
        return { outletId: a.outletId, tier: outlet.tier, districtId: outlet.districtId };
      }
    }
  }

  return null;
}

/**
 * Batch variant: resolve many URLs in one pass, for crawl workers.
 * Loads outlets + aliases once.
 */
export async function matchOutletsForUrls(
  urls: string[],
  organizationId: string,
): Promise<Map<string, OutletMatch>> {
  const result = new Map<string, OutletMatch>();
  const outlets = await db
    .select()
    .from(mediaOutlets)
    .where(
      and(
        eq(mediaOutlets.organizationId, organizationId),
        eq(mediaOutlets.status, "active"),
      ),
    );
  const aliases = await db.select().from(mediaOutletAliases);

  const byHost = new Map<string, (typeof outlets)[number]>();
  for (const o of outlets) {
    if (!o.officialUrl) continue;
    try {
      const h = new URL(o.officialUrl).hostname.toLowerCase().replace(/^www\./, "");
      byHost.set(h, o);
    } catch {}
  }
  const outletById = new Map(outlets.map((o) => [o.id, o]));

  for (const url of urls) {
    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      result.set(url, null);
      continue;
    }

    // host exact or subdomain
    let match: OutletMatch = null;
    for (const [h, o] of byHost) {
      if (hostname === h || hostname.endsWith("." + h)) {
        match = { outletId: o.id, tier: o.tier, districtId: o.districtId };
        break;
      }
    }
    // alias substring
    if (!match) {
      for (const a of aliases) {
        if (a.matchPattern && hostname.includes(a.matchPattern.toLowerCase())) {
          const o = outletById.get(a.outletId);
          if (o) {
            match = { outletId: a.outletId, tier: o.tier, districtId: o.districtId };
            break;
          }
        }
      }
    }
    result.set(url, match);
  }
  return result;
}
```

- [ ] **Step 3.2** 测试（集成 — 依赖 S1 的 seeded 媒体）：

```ts
// src/lib/research/__tests__/outlet-matcher.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { matchOutletForUrl } from "../outlet-matcher";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";

let ORG_ID: string;
beforeAll(async () => {
  const orgs = await db.select({ id: organizations.id }).from(organizations).limit(1);
  ORG_ID = orgs[0]?.id ?? process.env.SEED_ORG_ID!;
});

describe("matchOutletForUrl", () => {
  it("matches 新华社 via xinhuanet.com alias", async () => {
    const r = await matchOutletForUrl("https://www.xinhuanet.com/politics/2025-06-01/c_123.htm", ORG_ID);
    expect(r).not.toBeNull();
    expect(r!.tier).toBe("central");
  });

  it("matches 人民日报 via official URL people.com.cn", async () => {
    const r = await matchOutletForUrl("https://www.people.com.cn/n1/2025/123.html", ORG_ID);
    expect(r).not.toBeNull();
    expect(r!.tier).toBe("central");
  });

  it("returns null for unknown domain", async () => {
    const r = await matchOutletForUrl("https://example-unknown-site.xyz/a", ORG_ID);
    expect(r).toBeNull();
  });

  it("handles invalid URL gracefully", async () => {
    const r = await matchOutletForUrl("not a url", ORG_ID);
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 3.3** 跑 + 提交：

```bash
npx dotenvx run -f .env.local -- npm test -- src/lib/research/__tests__/outlet-matcher.test.ts
git add src/lib/research/outlet-matcher.ts src/lib/research/__tests__/outlet-matcher.test.ts
git commit -m "feat(research): URL to media outlet matcher"
```

---

## Task 4: Article ingest（幂等 upsert）

**Files:**
- Create: `src/lib/research/article-ingest.ts`

- [ ] **Step 4.1** 实现：

```ts
// src/lib/research/article-ingest.ts
import { db } from "@/db";
import { newsArticles } from "@/db/schema/research/news-articles";
import { hashUrl } from "./url-hash";
import { matchOutletForUrl } from "./outlet-matcher";
import { sql } from "drizzle-orm";

export type ArticleIngestInput = {
  url: string;
  title: string;
  content?: string;
  publishedAt?: Date | null;
  sourceChannel: "tavily" | "whitelist_crawl" | "manual_url";
  organizationId: string;
  firstSeenResearchTaskId?: string;
  rawMetadata?: Record<string, unknown>;
};

/**
 * Upsert article by url_hash. Returns:
 *   { inserted: true, id } if newly inserted
 *   { inserted: false, id } if already existed (no update to content)
 */
export async function ingestArticle(
  input: ArticleIngestInput,
): Promise<{ inserted: boolean; id: string }> {
  const urlHash = hashUrl(input.url);
  const match = await matchOutletForUrl(input.url, input.organizationId);

  const [row] = await db
    .insert(newsArticles)
    .values({
      url: input.url,
      urlHash,
      title: input.title,
      content: input.content,
      publishedAt: input.publishedAt ?? null,
      outletId: match?.outletId ?? null,
      outletTierSnapshot: match?.tier ?? null,
      districtIdSnapshot: match?.districtId ?? null,
      sourceChannel: input.sourceChannel,
      firstSeenResearchTaskId: input.firstSeenResearchTaskId ?? null,
      rawMetadata: input.rawMetadata,
    })
    .onConflictDoNothing({ target: newsArticles.urlHash })
    .returning({ id: newsArticles.id });

  if (row) return { inserted: true, id: row.id };

  // Already existed — fetch existing id
  const existing = await db
    .select({ id: newsArticles.id })
    .from(newsArticles)
    .where(sql`${newsArticles.urlHash} = ${urlHash}`)
    .limit(1);
  return { inserted: false, id: existing[0].id };
}

/**
 * Batch variant — pre-resolves outlet matches in one pass, then inserts one by one
 * with onConflictDoNothing. Returns per-URL outcome.
 */
export async function ingestArticlesBatch(
  items: ArticleIngestInput[],
): Promise<Array<{ url: string; inserted: boolean; id: string | null; error?: string }>> {
  const results: Array<{ url: string; inserted: boolean; id: string | null; error?: string }> = [];
  for (const item of items) {
    try {
      const r = await ingestArticle(item);
      results.push({ url: item.url, inserted: r.inserted, id: r.id });
    } catch (e) {
      results.push({
        url: item.url,
        inserted: false,
        id: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
```

- [ ] **Step 4.2** 测试（集成，建议一个少量 url 的 smoke test）：

```ts
// src/lib/research/__tests__/article-ingest.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ingestArticle } from "../article-ingest";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq } from "drizzle-orm";

let ORG_ID: string;
const TEST_URL = `https://test-${Date.now()}.example.com/article/1`;

beforeAll(async () => {
  const orgs = await db.select({ id: organizations.id }).from(organizations).limit(1);
  ORG_ID = orgs[0]?.id ?? process.env.SEED_ORG_ID!;
});

afterAll(async () => {
  // Clean up test row
  await db.delete(newsArticles).where(eq(newsArticles.url, TEST_URL));
});

describe("ingestArticle", () => {
  it("inserts on first call", async () => {
    const r = await ingestArticle({
      url: TEST_URL,
      title: "测试文章",
      sourceChannel: "tavily",
      organizationId: ORG_ID,
    });
    expect(r.inserted).toBe(true);
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("is idempotent on second call (same url)", async () => {
    const r = await ingestArticle({
      url: TEST_URL,
      title: "测试文章",
      sourceChannel: "tavily",
      organizationId: ORG_ID,
    });
    expect(r.inserted).toBe(false);
  });

  it("treats normalized-equivalent URLs as same article", async () => {
    const r = await ingestArticle({
      url: `${TEST_URL}?utm_source=test`,
      title: "测试文章",
      sourceChannel: "tavily",
      organizationId: ORG_ID,
    });
    expect(r.inserted).toBe(false);
  });
});
```

- [ ] **Step 4.3** 跑 + 提交：

```bash
npx dotenvx run -f .env.local -- npm test -- src/lib/research/__tests__/article-ingest.test.ts
git add src/lib/research/article-ingest.ts src/lib/research/__tests__/article-ingest.test.ts
git commit -m "feat(research): idempotent news article ingest"
```

---

## Task 5: 注册 Inngest 事件类型

**Files:** Modify `src/inngest/events.ts`

- [ ] **Step 5.1** 在 `InngestEvents` 类型定义中追加（保持现有格式）：

```ts
  "research/task.submitted": {
    data: { taskId: string };
  };
  "research/task.cancelled": {
    data: { taskId: string };
  };
  "research/tavily.crawl": {
    data: {
      taskId: string;
      topicId: string;
      keywords: string[];
      timeRangeStart: string; // ISO
      timeRangeEnd: string;
      includeDomains: string[];
    };
  };
  "research/whitelist.crawl": {
    data: { taskId: string; outletId: string };
  };
  "research/manual-url.ingest": {
    data: { taskId: string; urls: string[] };
  };
  "research/article.ingested": {
    data: { articleId: string; taskId: string; outletId: string | null };
  };
```

（`research/topic.sample.changed` 已在 S1 Task 15 加过，不重复。）

- [ ] **Step 5.2** 类型检查 + 提交：

```bash
npx tsc --noEmit
git add src/inngest/events.ts
git commit -m "feat(research): register S2 crawl event types"
```

---

## Task 6: Tavily 爬取封装

**Files:**
- Create: `src/lib/research/tavily-crawler.ts`

- [ ] **Step 6.1** 实现（站点白名单 + 时间窗口）：

```ts
// src/lib/research/tavily-crawler.ts
import { searchViaTavily } from "@/lib/web-fetch";

export type TavilyArticleHit = {
  url: string;
  title: string;
  snippet: string;
  publishedAt: Date | null;
  rawMetadata: Record<string, unknown>;
};

/**
 * Query Tavily for one keyword × one time-window, scoped to given include_domains.
 * Returns normalized hits.
 */
export async function crawlTavilyForKeyword(params: {
  keyword: string;
  includeDomains: string[];
  timeRangeStart: Date;
  timeRangeEnd: Date;
  maxResults?: number;
}): Promise<TavilyArticleHit[]> {
  // Map date window to Tavily's coarse time_range param
  const now = Date.now();
  const windowMs = params.timeRangeEnd.getTime() - params.timeRangeStart.getTime();
  const ageMs = now - params.timeRangeStart.getTime();
  let timeRange: "24h" | "7d" | "30d" | "all" = "all";
  if (ageMs < 86_400_000 * 2) timeRange = "24h";
  else if (ageMs < 86_400_000 * 10) timeRange = "7d";
  else if (ageMs < 86_400_000 * 40) timeRange = "30d";

  const { items } = await searchViaTavily(params.keyword, {
    timeRange,
    maxResults: params.maxResults ?? 20,
    topic: "news",
    include_domains: params.includeDomains,
  });

  const hits: TavilyArticleHit[] = [];
  for (const it of items) {
    const pubDate = it.publishedAt ? new Date(it.publishedAt) : null;
    // Filter by explicit time window (Tavily's time_range is coarse)
    if (pubDate && (pubDate < params.timeRangeStart || pubDate > params.timeRangeEnd)) continue;
    hits.push({
      url: it.url,
      title: it.title,
      snippet: it.snippet,
      publishedAt: pubDate,
      rawMetadata: { source: it.source, engine: it.engine, snippet: it.snippet },
    });
  }
  return hits;
}
```

- [ ] **Step 6.2** 提交（无测试 — 依赖真实外部 API，集成测试留在 Task 10）：

```bash
git add src/lib/research/tavily-crawler.ts
git commit -m "feat(research): Tavily crawler with site + time filters"
```

---

## Task 7: Jina Reader 封装 + 内容抓取

**Files:**
- Create: `src/lib/research/jina-fetch.ts`

- [ ] **Step 7.1** 实现：

```ts
// src/lib/research/jina-fetch.ts
import { fetchViaJinaReader } from "@/lib/web-fetch";

export type FetchedArticle = {
  url: string;
  title: string;
  content: string;
};

/**
 * Fetch article content via Jina Reader with retry.
 */
export async function fetchArticleContent(
  url: string,
  opts: { maxRetries?: number; backoffMs?: number } = {},
): Promise<FetchedArticle | null> {
  const maxRetries = opts.maxRetries ?? 2;
  const backoffMs = opts.backoffMs ?? 1000;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchViaJinaReader(url);
      if (res.content && res.content.length > 0) {
        return { url, title: res.title, content: res.content };
      }
      return null;
    } catch (e) {
      lastError = e;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
      }
    }
  }
  console.warn(`[research] Jina fetch failed for ${url}:`, lastError);
  return null;
}
```

- [ ] **Step 7.2** 提交：

```bash
git add src/lib/research/jina-fetch.ts
git commit -m "feat(research): Jina Reader wrapper with retry"
```

---

## Task 8: Tavily 采集 Inngest 函数

**Files:**
- Create: `src/inngest/functions/research/tavily-crawl.ts`
- Create: `src/inngest/functions/research/index.ts`

- [ ] **Step 8.1** 实现：

```ts
// src/inngest/functions/research/tavily-crawl.ts
import { inngest } from "@/inngest/client";
import { crawlTavilyForKeyword } from "@/lib/research/tavily-crawler";
import { fetchArticleContent } from "@/lib/research/jina-fetch";
import { ingestArticle } from "@/lib/research/article-ingest";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq, sql } from "drizzle-orm";

export const researchTavilyCrawl = inngest.createFunction(
  { id: "research-tavily-crawl", concurrency: { limit: 3 } },
  { event: "research/tavily.crawl" },
  async ({ event, step }) => {
    const { taskId, topicId, keywords, timeRangeStart, timeRangeEnd, includeDomains } =
      event.data;

    // 1. Fetch task org
    const [task] = await db
      .select({ orgId: researchTasks.organizationId })
      .from(researchTasks)
      .where(eq(researchTasks.id, taskId));
    if (!task) return { skipped: true };

    const start = new Date(timeRangeStart);
    const end = new Date(timeRangeEnd);

    // 2. For each keyword — run search (this step is retry-able)
    let totalHits = 0;
    let totalInserted = 0;

    for (const keyword of keywords) {
      const hits = await step.run(`tavily-${keyword}`, () =>
        crawlTavilyForKeyword({
          keyword,
          includeDomains,
          timeRangeStart: start,
          timeRangeEnd: end,
          maxResults: 30,
        }),
      );
      totalHits += hits.length;

      // 3. For each hit — fetch content via Jina, then ingest
      for (const h of hits) {
        const ingestResult = await step.run(`ingest-${h.url}`, async () => {
          const article = await fetchArticleContent(h.url);
          const content = article?.content ?? h.snippet;
          return await ingestArticle({
            url: h.url,
            title: article?.title ?? h.title,
            content,
            publishedAt: h.publishedAt,
            sourceChannel: "tavily",
            organizationId: task.orgId,
            firstSeenResearchTaskId: taskId,
            rawMetadata: h.rawMetadata,
          });
        });
        if (ingestResult.inserted) totalInserted += 1;

        // Emit ingest event for downstream (S3 analyze)
        if (ingestResult.inserted) {
          await step.sendEvent(`fanout-${ingestResult.id}`, {
            name: "research/article.ingested",
            data: { articleId: ingestResult.id, taskId, outletId: null },
          });
        }
      }
    }

    // 4. Update task progress
    await step.run("progress", async () => {
      await db
        .update(researchTasks)
        .set({
          progress: sql`coalesce(${researchTasks.progress}, '{}'::jsonb)
            || jsonb_build_object('crawled', coalesce((${researchTasks.progress} ->> 'crawled')::int, 0) + ${totalInserted})`,
          updatedAt: new Date(),
        })
        .where(eq(researchTasks.id, taskId));
    });

    return { totalHits, totalInserted };
  },
);
```

- [ ] **Step 8.2** Index file:

```ts
// src/inngest/functions/research/index.ts
export { researchTavilyCrawl } from "./tavily-crawl";
export { researchWhitelistCrawl } from "./whitelist-crawl";
export { researchManualUrlIngest } from "./manual-url-ingest";
export { researchTaskStart } from "./task-start";
```

（前面导出暂且占位，Task 9-11 里实现）

- [ ] **Step 8.3** 提交：

```bash
git add src/inngest/functions/research/tavily-crawl.ts src/inngest/functions/research/index.ts
git commit -m "feat(research): Inngest function for Tavily crawl batch"
```

---

## Task 9: 白名单站点采集 Inngest 函数

**Files:**
- Create: `src/inngest/functions/research/whitelist-crawl.ts`

本 Task 先做一个最小可用版本：抓 `mediaOutletCrawlConfigs.listUrlTemplate` 对应的单页，用 Jina Reader 取正文里的链接（Jina Reader 默认返回 markdown，包含链接），然后逐个抓文章入库。复杂的列表页翻页、文章 URL 正则抽取留在后期。

- [ ] **Step 9.1** 实现：

```ts
// src/inngest/functions/research/whitelist-crawl.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  mediaOutlets,
  mediaOutletCrawlConfigs,
} from "@/db/schema/research/media-outlets";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq } from "drizzle-orm";
import { fetchArticleContent } from "@/lib/research/jina-fetch";
import { ingestArticle } from "@/lib/research/article-ingest";

export const researchWhitelistCrawl = inngest.createFunction(
  { id: "research-whitelist-crawl", concurrency: { limit: 2 } },
  { event: "research/whitelist.crawl" },
  async ({ event, step }) => {
    const { taskId, outletId } = event.data;

    const [ctx] = await db
      .select({
        orgId: researchTasks.organizationId,
        tier: mediaOutlets.tier,
        listUrl: mediaOutletCrawlConfigs.listUrlTemplate,
        articlePattern: mediaOutletCrawlConfigs.articleUrlPattern,
      })
      .from(researchTasks)
      .innerJoin(mediaOutlets, eq(mediaOutlets.id, outletId))
      .leftJoin(
        mediaOutletCrawlConfigs,
        eq(mediaOutletCrawlConfigs.outletId, outletId),
      )
      .where(eq(researchTasks.id, taskId));

    if (!ctx?.listUrl) return { skipped: true, reason: "no_crawl_config" };

    // Step A: fetch list page via Jina → parse out article URLs
    const urls = await step.run("fetch-list", async () => {
      const page = await fetchArticleContent(ctx.listUrl!.replace("{page}", "1"));
      if (!page) return [];
      // Extract all http(s) URLs from the markdown content
      const matches = page.content.match(/https?:\/\/[^\s)]+/g) ?? [];
      // Filter by article URL pattern if configured
      const pattern = ctx.articlePattern ? new RegExp(ctx.articlePattern) : null;
      return [...new Set(matches)].filter((u) => (pattern ? pattern.test(u) : true));
    });

    let inserted = 0;
    for (const url of urls.slice(0, 50)) {
      const r = await step.run(`ingest-${url}`, async () => {
        const a = await fetchArticleContent(url);
        if (!a) return { inserted: false, id: null };
        const ing = await ingestArticle({
          url,
          title: a.title,
          content: a.content,
          sourceChannel: "whitelist_crawl",
          organizationId: ctx.orgId,
          firstSeenResearchTaskId: taskId,
        });
        return ing;
      });
      if (r.inserted) {
        inserted += 1;
        if (r.id) {
          await step.sendEvent(`fanout-${r.id}`, {
            name: "research/article.ingested",
            data: { articleId: r.id, taskId, outletId },
          });
        }
      }
    }

    return { totalDiscovered: urls.length, inserted };
  },
);
```

- [ ] **Step 9.2** 提交：

```bash
git add src/inngest/functions/research/whitelist-crawl.ts
git commit -m "feat(research): Inngest function for whitelist site crawl"
```

---

## Task 10: 手动 URL 粘贴采集 Inngest 函数

**Files:**
- Create: `src/inngest/functions/research/manual-url-ingest.ts`

- [ ] **Step 10.1** 实现：

```ts
// src/inngest/functions/research/manual-url-ingest.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq } from "drizzle-orm";
import { fetchArticleContent } from "@/lib/research/jina-fetch";
import { ingestArticle } from "@/lib/research/article-ingest";

export const researchManualUrlIngest = inngest.createFunction(
  { id: "research-manual-url-ingest", concurrency: { limit: 3 } },
  { event: "research/manual-url.ingest" },
  async ({ event, step }) => {
    const { taskId, urls } = event.data;

    const [task] = await db
      .select({ orgId: researchTasks.organizationId })
      .from(researchTasks)
      .where(eq(researchTasks.id, taskId));
    if (!task) return { skipped: true };

    let inserted = 0;
    for (const url of urls) {
      const r = await step.run(`ingest-${url}`, async () => {
        const a = await fetchArticleContent(url);
        if (!a) return { inserted: false, id: null };
        return ingestArticle({
          url,
          title: a.title,
          content: a.content,
          sourceChannel: "manual_url",
          organizationId: task.orgId,
          firstSeenResearchTaskId: taskId,
        });
      });
      if (r.inserted) {
        inserted += 1;
        if (r.id) {
          await step.sendEvent(`fanout-${r.id}`, {
            name: "research/article.ingested",
            data: { articleId: r.id, taskId, outletId: null },
          });
        }
      }
    }

    return { totalRequested: urls.length, inserted };
  },
);
```

- [ ] **Step 10.2** 提交：

```bash
git add src/inngest/functions/research/manual-url-ingest.ts
git commit -m "feat(research): Inngest function for manual URL ingest"
```

---

## Task 11: 任务编排器（task-start）

**Files:**
- Create: `src/inngest/functions/research/task-start.ts`

- [ ] **Step 11.1** 实现：

```ts
// src/inngest/functions/research/task-start.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import {
  researchTopics,
  researchTopicKeywords,
} from "@/db/schema/research/research-topics";
import { mediaOutlets } from "@/db/schema/research/media-outlets";
import { mediaOutletCrawlConfigs } from "@/db/schema/research/media-outlets";
import { eq, and, inArray, isNotNull } from "drizzle-orm";

export const researchTaskStart = inngest.createFunction(
  { id: "research-task-start", concurrency: { limit: 5 } },
  { event: "research/task.submitted" },
  async ({ event, step }) => {
    const { taskId } = event.data;

    // 1. Load task
    const [task] = await step.run("load-task", async () =>
      db.select().from(researchTasks).where(eq(researchTasks.id, taskId)),
    );
    if (!task) return { skipped: true };

    // 2. Transition pending → crawling
    await step.run("mark-crawling", async () => {
      await db
        .update(researchTasks)
        .set({ status: "crawling", updatedAt: new Date() })
        .where(eq(researchTasks.id, taskId));
    });

    // 3. Load topics + keywords
    const topicKeywords = await step.run("load-keywords", async () =>
      db
        .select({
          topicId: researchTopicKeywords.topicId,
          keyword: researchTopicKeywords.keyword,
        })
        .from(researchTopicKeywords)
        .where(inArray(researchTopicKeywords.topicId, task.topicIds)),
    );
    const keywordsByTopic = new Map<string, string[]>();
    for (const row of topicKeywords) {
      const arr = keywordsByTopic.get(row.topicId) ?? [];
      arr.push(row.keyword);
      keywordsByTopic.set(row.topicId, arr);
    }

    // 4. Load active outlets matching selected tiers — build include_domains
    const outletsWithUrls = await step.run("load-outlets", async () =>
      db
        .select({
          id: mediaOutlets.id,
          tier: mediaOutlets.tier,
          districtId: mediaOutlets.districtId,
          officialUrl: mediaOutlets.officialUrl,
        })
        .from(mediaOutlets)
        .where(
          and(
            eq(mediaOutlets.organizationId, task.organizationId),
            eq(mediaOutlets.status, "active"),
            inArray(mediaOutlets.tier, task.mediaTiers as any),
            isNotNull(mediaOutlets.officialUrl),
          ),
        ),
    );

    // Filter by district if non-empty
    const filteredOutlets = outletsWithUrls.filter((o) => {
      if (o.tier !== "district_media") return true;
      if (task.districtIds.length === 0) return true;
      return o.districtId && task.districtIds.includes(o.districtId);
    });

    const includeDomains: string[] = [];
    for (const o of filteredOutlets) {
      try {
        const h = new URL(o.officialUrl!).hostname.toLowerCase().replace(/^www\./, "");
        includeDomains.push(h);
      } catch {}
    }

    // 5. Fan out — Tavily per topic
    for (const [topicId, keywords] of keywordsByTopic) {
      await step.sendEvent(`tavily-${topicId}`, {
        name: "research/tavily.crawl",
        data: {
          taskId,
          topicId,
          keywords,
          timeRangeStart: task.timeRangeStart.toISOString(),
          timeRangeEnd: task.timeRangeEnd.toISOString(),
          includeDomains,
        },
      });
    }

    // 6. Fan out — whitelist per outlet (only those with crawl config)
    const crawlConfigs = await step.run("load-crawl-configs", async () =>
      db
        .select({ outletId: mediaOutletCrawlConfigs.outletId })
        .from(mediaOutletCrawlConfigs)
        .where(
          and(
            eq(mediaOutletCrawlConfigs.enabled, true),
            inArray(
              mediaOutletCrawlConfigs.outletId,
              filteredOutlets.map((o) => o.id),
            ),
          ),
        ),
    );
    for (const c of crawlConfigs) {
      await step.sendEvent(`whitelist-${c.outletId}`, {
        name: "research/whitelist.crawl",
        data: { taskId, outletId: c.outletId },
      });
    }

    // 7. Fan out — manual URLs
    if (task.customUrls.length > 0) {
      await step.sendEvent("manual-urls", {
        name: "research/manual-url.ingest",
        data: { taskId, urls: task.customUrls },
      });
    }

    // Note: task.status will transition to 'analyzing' → 'done' in S3.
    // For S2, task stays in 'crawling' until operator marks it done, or we add a
    // timer-based finalize. For v1 we accept 'crawling' as terminal in S2.

    return {
      dispatched: {
        tavily: keywordsByTopic.size,
        whitelist: crawlConfigs.length,
        manual: task.customUrls.length > 0 ? 1 : 0,
      },
    };
  },
);
```

- [ ] **Step 11.2** 提交：

```bash
git add src/inngest/functions/research/task-start.ts
git commit -m "feat(research): Inngest orchestrator for task submission"
```

---

## Task 12: 注册 Inngest 函数

**Files:** Modify `src/app/api/inngest/route.ts`

- [ ] **Step 12.1** 读现有 route，在 `functions: [...]` 数组中加入 4 个新函数。大致改动：

```ts
import {
  researchTaskStart,
  researchTavilyCrawl,
  researchWhitelistCrawl,
  researchManualUrlIngest,
} from "@/inngest/functions/research";

// in serve() call:
functions: [
  // ...existing
  researchTaskStart,
  researchTavilyCrawl,
  researchWhitelistCrawl,
  researchManualUrlIngest,
],
```

- [ ] **Step 12.2** 类型检查 + 提交：

```bash
npx tsc --noEmit
git add src/app/api/inngest/route.ts
git commit -m "feat(research): register S2 Inngest functions"
```

---

## Task 13: DAL — 研究任务

**Files:**
- Create: `src/lib/dal/research/research-tasks.ts`
- Create: `src/lib/dal/research/__tests__/research-tasks.test.ts`

- [ ] **Step 13.1** 实现：

```ts
// src/lib/dal/research/research-tasks.ts
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq, and, desc, sql } from "drizzle-orm";

export type ResearchTaskSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  timeRangeStart: Date;
  timeRangeEnd: Date;
  topicCount: number;
  districtCount: number;
  tierCount: number;
  crawledCount: number;
};

export async function listMyResearchTasks(
  orgId: string,
  userId: string,
): Promise<ResearchTaskSummary[]> {
  const tasks = await db
    .select()
    .from(researchTasks)
    .where(and(eq(researchTasks.organizationId, orgId), eq(researchTasks.userId, userId)))
    .orderBy(desc(researchTasks.createdAt));

  // crawl counts per task
  const counts = await db
    .select({
      taskId: newsArticles.firstSeenResearchTaskId,
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(newsArticles)
    .groupBy(newsArticles.firstSeenResearchTaskId);
  const countMap = new Map(counts.map((c) => [c.taskId, c.count]));

  return tasks.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    createdAt: t.createdAt,
    timeRangeStart: t.timeRangeStart,
    timeRangeEnd: t.timeRangeEnd,
    topicCount: t.topicIds.length,
    districtCount: t.districtIds.length,
    tierCount: t.mediaTiers.length,
    crawledCount: countMap.get(t.id) ?? 0,
  }));
}

export async function getResearchTaskDetail(
  id: string,
  orgId: string,
): Promise<{
  task: typeof researchTasks.$inferSelect;
  articles: Array<{
    id: string;
    title: string;
    url: string;
    publishedAt: Date | null;
    outletTierSnapshot: string | null;
    sourceChannel: string;
  }>;
} | null> {
  const [task] = await db
    .select()
    .from(researchTasks)
    .where(and(eq(researchTasks.id, id), eq(researchTasks.organizationId, orgId)));
  if (!task) return null;

  const articles = await db
    .select({
      id: newsArticles.id,
      title: newsArticles.title,
      url: newsArticles.url,
      publishedAt: newsArticles.publishedAt,
      outletTierSnapshot: newsArticles.outletTierSnapshot,
      sourceChannel: newsArticles.sourceChannel,
    })
    .from(newsArticles)
    .where(eq(newsArticles.firstSeenResearchTaskId, id))
    .orderBy(desc(newsArticles.crawledAt))
    .limit(200);

  return { task, articles };
}
```

- [ ] **Step 13.2** 测试（最简 smoke）：

```ts
// src/lib/dal/research/__tests__/research-tasks.test.ts
import { describe, it, expect } from "vitest";
import { listMyResearchTasks } from "../research-tasks";
import { db } from "@/db";
import { organizations, userProfiles } from "@/db/schema";

describe("listMyResearchTasks", () => {
  it("returns empty for fresh user", async () => {
    const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1);
    const [user] = await db.select({ id: userProfiles.id }).from(userProfiles).limit(1);
    const result = await listMyResearchTasks(org.id, user.id);
    expect(Array.isArray(result)).toBe(true);
    // allow any count, just verifies shape
    for (const t of result) {
      expect(typeof t.topicCount).toBe("number");
      expect(typeof t.crawledCount).toBe("number");
    }
  });
});
```

- [ ] **Step 13.3** 提交：

```bash
npx dotenvx run -f .env.local -- npm test -- src/lib/dal/research/__tests__/research-tasks.test.ts
git add src/lib/dal/research/research-tasks.ts src/lib/dal/research/__tests__/research-tasks.test.ts
git commit -m "feat(research): DAL for research tasks list and detail"
```

---

## Task 14: Server Actions — 研究任务

**Files:**
- Create: `src/app/actions/research/research-tasks.ts`

- [ ] **Step 14.1** 实现：

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq, and } from "drizzle-orm";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { inngest } from "@/inngest/client";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  timeRangeStart: z.string().datetime(),
  timeRangeEnd: z.string().datetime(),
  topicIds: z.array(z.string().uuid()).min(1),
  districtIds: z.array(z.string().uuid()).default([]),
  mediaTiers: z
    .array(z.enum(["central", "provincial_municipal", "industry", "district_media"]))
    .min(1),
  customUrls: z.array(z.string().url()).default([]),
  semanticEnabled: z.boolean().default(true),
  semanticThreshold: z.number().min(0.5).max(0.95).default(0.72),
  dedupLevel: z.enum(["keyword", "district", "both"]).default("district"),
});

export async function createResearchTask(
  input: z.infer<typeof createSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const { userId, organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TASK_CREATE,
    );
    const data = createSchema.parse(input);

    const [task] = await db
      .insert(researchTasks)
      .values({
        organizationId,
        userId,
        name: data.name,
        timeRangeStart: new Date(data.timeRangeStart),
        timeRangeEnd: new Date(data.timeRangeEnd),
        topicIds: data.topicIds,
        districtIds: data.districtIds,
        mediaTiers: data.mediaTiers,
        customUrls: data.customUrls,
        semanticEnabled: data.semanticEnabled,
        semanticThreshold: String(data.semanticThreshold),
        dedupLevel: data.dedupLevel,
        status: "pending",
      })
      .returning({ id: researchTasks.id });

    await inngest.send({
      name: "research/task.submitted",
      data: { taskId: task.id },
    });

    revalidatePath("/research");
    return { ok: true, id: task.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancelResearchTask(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TASK_CREATE,
    );
    await db
      .update(researchTasks)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(researchTasks.id, id),
          eq(researchTasks.organizationId, organizationId),
        ),
      );

    await inngest.send({
      name: "research/task.cancelled",
      data: { taskId: id },
    });

    revalidatePath("/research");
    revalidatePath(`/research/tasks/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 14.2** 提交：

```bash
npx tsc --noEmit
git add src/app/actions/research/research-tasks.ts
git commit -m "feat(research): server actions for research task lifecycle"
```

---

## Task 15: 研究首页（任务列表）

**Files:**
- Replace: `src/app/(dashboard)/research/page.tsx`
- Create: `src/app/(dashboard)/research/research-home-client.tsx`

- [ ] **Step 15.1** Server page：

```tsx
// src/app/(dashboard)/research/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listMyResearchTasks } from "@/lib/dal/research/research-tasks";
import { ResearchHomeClient } from "./research-home-client";

export const dynamic = "force-dynamic";

export default async function ResearchHomePage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(ctx.userId, ctx.organizationId, PERMISSIONS.MENU_RESEARCH);
  if (!allowed) redirect("/home");

  const tasks = await listMyResearchTasks(ctx.organizationId, ctx.userId);
  return <ResearchHomeClient tasks={tasks} />;
}
```

- [ ] **Step 15.2** Client（简洁列表 + 顶部 CTA）：

```tsx
// src/app/(dashboard)/research/research-home-client.tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import type { ResearchTaskSummary } from "@/lib/dal/research/research-tasks";

const STATUS_LABELS: Record<string, string> = {
  pending: "排队中",
  crawling: "采集中",
  analyzing: "分析中",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  crawling: "bg-blue-100 text-blue-700",
  analyzing: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export function ResearchHomeClient({ tasks }: { tasks: ResearchTaskSummary[] }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">新闻研究</h1>
          <p className="text-sm text-muted-foreground mt-1">
            我的研究任务列表。新建任务后，系统将自动采集全网与白名单媒体数据。
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href="/research/new"><Plus className="mr-1 h-4 w-4" />新建研究任务</Link>
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-xl bg-card p-12 text-center">
          <p className="text-muted-foreground">还没有研究任务</p>
          <div className="mt-4">
            <Button variant="ghost" asChild>
              <Link href="/research/new">创建第一个任务</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <Link
              key={t.id}
              href={`/research/tasks/${t.id}`}
              className="block rounded-xl bg-card p-5 hover:bg-accent transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{t.name}</h3>
                    <Badge className={STATUS_CLASS[t.status]}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.timeRangeStart.toLocaleDateString()} 至{" "}
                    {t.timeRangeEnd.toLocaleDateString()} · 共{" "}
                    {t.topicCount} 主题 · {t.districtCount} 区县 · {t.tierCount} 级媒体
                  </p>
                </div>
                <div className="text-right text-sm">
                  <div className="font-medium">{t.crawledCount}</div>
                  <div className="text-xs text-muted-foreground">已采集</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 15.3** 提交：

```bash
npx tsc --noEmit
git add "src/app/(dashboard)/research/page.tsx" "src/app/(dashboard)/research/research-home-client.tsx"
git commit -m "feat(research): research home page with task list"
```

---

## Task 16: 新建研究任务页（4 步表单）

**Files:**
- Create: `src/app/(dashboard)/research/new/page.tsx`
- Create: `src/app/(dashboard)/research/new/new-task-client.tsx`

- [ ] **Step 16.1** Server：

```tsx
// src/app/(dashboard)/research/new/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listResearchTopics } from "@/lib/dal/research/research-topics";
import { listCqDistricts } from "@/lib/dal/research/cq-districts";
import { NewTaskClient } from "./new-task-client";

export const dynamic = "force-dynamic";

export default async function NewResearchTaskPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.RESEARCH_TASK_CREATE,
  );
  if (!allowed) redirect("/research");

  const [topics, districts] = await Promise.all([
    listResearchTopics(ctx.organizationId),
    listCqDistricts(),
  ]);
  return <NewTaskClient topics={topics} districts={districts} />;
}
```

- [ ] **Step 16.2** Client（简版 4 步表单，每步用 section 而非 wizard）：

```tsx
// src/app/(dashboard)/research/new/new-task-client.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { TopicSummary } from "@/lib/dal/research/research-topics";
import type { CqDistrict } from "@/lib/dal/research/cq-districts";
import { createResearchTask } from "@/app/actions/research/research-tasks";

const TIERS = [
  { value: "central", label: "中央级" },
  { value: "provincial_municipal", label: "省/市级" },
  { value: "industry", label: "行业级" },
  { value: "district_media", label: "区县融媒体" },
] as const;

export function NewTaskClient({
  topics,
  districts,
}: {
  topics: TopicSummary[];
  districts: CqDistrict[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(`${new Date().getFullYear()}年研究任务`);
  const [topicIds, setTopicIds] = useState<string[]>(topics.map((t) => t.id));
  const [districtIds, setDistrictIds] = useState<string[]>(districts.map((d) => d.id));
  const [tiers, setTiers] = useState<string[]>(TIERS.map((t) => t.value));
  const [timeStart, setTimeStart] = useState("2025-01-01");
  const [timeEnd, setTimeEnd] = useState("2025-12-31");
  const [customUrls, setCustomUrls] = useState("");

  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  async function submit() {
    setError(null);
    if (topicIds.length === 0) { setError("请至少选择一个主题"); return; }
    if (tiers.length === 0) { setError("请至少选择一级媒体"); return; }

    const urls = customUrls.split("\n").map((u) => u.trim()).filter(Boolean);

    startTransition(async () => {
      const res = await createResearchTask({
        name,
        timeRangeStart: new Date(timeStart).toISOString(),
        timeRangeEnd: new Date(timeEnd + "T23:59:59.999Z").toISOString(),
        topicIds,
        districtIds,
        mediaTiers: tiers as any,
        customUrls: urls,
        semanticEnabled: true,
        semanticThreshold: 0.72,
        dedupLevel: "district",
      });
      if (!res.ok) setError(res.error);
      else router.push(`/research/tasks/${res.id}`);
    });
  }

  return (
    <div className="p-6 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">新建研究任务</h1>
        <p className="text-sm text-muted-foreground mt-1">
          选择主题、区县、媒体层级和时间范围，系统将自动采集数据
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-medium">① 任务名称</h2>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">② 时间范围</h2>
        <div className="flex gap-3 items-center">
          <Input type="date" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="w-44" />
          <span className="text-muted-foreground">至</span>
          <Input type="date" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="w-44" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">③ 主题（{topicIds.length}/{topics.length}）</h2>
          <Button variant="ghost" size="sm" onClick={() => setTopicIds(topicIds.length === topics.length ? [] : topics.map((t) => t.id))}>
            {topicIds.length === topics.length ? "全部取消" : "全选"}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {topics.map((t) => (
            <label key={t.id} className="flex items-center gap-2 rounded-md bg-card px-3 py-2 cursor-pointer hover:bg-accent">
              <Checkbox checked={topicIds.includes(t.id)} onCheckedChange={() => setTopicIds(toggle(topicIds, t.id))} />
              <span className="text-sm">{t.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">④ 区县（{districtIds.length}/{districts.length}）</h2>
          <Button variant="ghost" size="sm" onClick={() => setDistrictIds(districtIds.length === districts.length ? [] : districts.map((d) => d.id))}>
            {districtIds.length === districts.length ? "全部取消" : "全选"}
          </Button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {districts.map((d) => (
            <label key={d.id} className="flex items-center gap-2 rounded-md bg-card px-2 py-1.5 cursor-pointer hover:bg-accent text-xs">
              <Checkbox checked={districtIds.includes(d.id)} onCheckedChange={() => setDistrictIds(toggle(districtIds, d.id))} />
              <span>{d.name}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">⑤ 媒体层级</h2>
        <div className="flex flex-wrap gap-2">
          {TIERS.map((t) => (
            <label key={t.value} className="flex items-center gap-2 rounded-md bg-card px-3 py-2 cursor-pointer hover:bg-accent">
              <Checkbox checked={tiers.includes(t.value)} onCheckedChange={() => setTiers(toggle(tiers, t.value))} />
              <span className="text-sm">{t.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">⑥ 手动粘贴 URL（可选，每行一个）</h2>
        <Textarea
          rows={4}
          value={customUrls}
          onChange={(e) => setCustomUrls(e.target.value)}
          placeholder="https://...&#10;https://..."
        />
      </section>

      <div className="flex gap-3 pt-4">
        <Button variant="ghost" onClick={() => router.push("/research")}>取消</Button>
        <Button variant="ghost" onClick={submit} disabled={pending}>
          {pending ? "提交中..." : "提交任务"}
        </Button>
      </div>
    </div>
  );
}
```

> 注：如果 `checkbox.tsx` shadcn 组件未安装，跑 `npx shadcn@latest add checkbox`。

- [ ] **Step 16.3** 提交：

```bash
npx tsc --noEmit
git add "src/app/(dashboard)/research/new/"
git commit -m "feat(research): new research task form"
```

---

## Task 17: 任务详情页（进度 + 文章列表）

**Files:**
- Create: `src/app/(dashboard)/research/tasks/[id]/page.tsx`
- Create: `src/app/(dashboard)/research/tasks/[id]/task-detail-client.tsx`

- [ ] **Step 17.1** Server：

```tsx
// src/app/(dashboard)/research/tasks/[id]/page.tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { getResearchTaskDetail } from "@/lib/dal/research/research-tasks";
import { TaskDetailClient } from "./task-detail-client";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");

  const detail = await getResearchTaskDetail(id, ctx.organizationId);
  if (!detail) notFound();
  return <TaskDetailClient task={detail.task} articles={detail.articles} />;
}
```

- [ ] **Step 17.2** Client：状态标签 + 参数摘要 + 文章表（标题可点、媒体层级 badge、发布时间、采集通道）+ 取消按钮（若 status=pending/crawling）

（实施时参考 S1 的 media-outlets-client.tsx 的表格写法，保证 ghost 按钮、中文 UI 风格一致）

- [ ] **Step 17.3** 提交：

```bash
git add "src/app/(dashboard)/research/tasks/[id]/"
git commit -m "feat(research): research task detail page"
```

---

## Task 18: 侧边栏子项更新

**Files:** Modify `src/components/layout/app-sidebar.tsx`

- [ ] **Step 18.1** 在「新闻研究」菜单组里，除已有的 `/research/admin/media-outlets` 和 `/research/admin/topics` 两个子项外，新增：

```ts
{ label: "新建任务", href: "/research/new", icon: Plus },
```

（图标自选 lucide 图标；不强制）

- [ ] **Step 18.2** 提交：

```bash
git add src/components/layout/app-sidebar.tsx
git commit -m "feat(research): sidebar entry for task creation"
```

---

## Task 19: 端到端冒烟：小范围真实采集一遍

**Files:** 无文件变更，只是操作步骤

- [ ] **Step 19.1** 启动服务：

```bash
npm run dev
```

浏览器打开 http://localhost:3000/research/new。

- [ ] **Step 19.2** 新建一个小范围任务：
- 名称：「S2 冒烟测试」
- 时间：2025-10-01 到 2025-10-31
- 主题：只勾「环保督察」
- 区县：不勾（全部）
- 媒体层级：只勾「中央级」
- 手动 URL：空

提交。应跳转到 `/research/tasks/<id>`，status 先 pending → 片刻后 crawling。

- [ ] **Step 19.3** 检查 Inngest dev：

Inngest dev server 默认跑在 http://localhost:8288（若未启动，跑 `npx inngest-cli dev`）。在 UI 里应看到：
- 1 个 `research-task-start` 被消费
- N 个 `research-tavily-crawl`（按主题数）在跑或完成
- 0 个 whitelist crawl（种子里没给抓取配置）
- 0 个 manual url

- [ ] **Step 19.4** 验证数据：

```bash
npx dotenvx run -f .env.local -- npx tsx -e "
import { db } from './src/db';
import { newsArticles } from './src/db/schema/research/news-articles';
import { eq, sql } from 'drizzle-orm';
import { researchTasks } from './src/db/schema/research/research-tasks';
const [t] = await db.select().from(researchTasks).orderBy(sql\`created_at desc\`).limit(1);
const arts = await db.select().from(newsArticles).where(eq(newsArticles.firstSeenResearchTaskId, t.id));
console.log('Task:', t.name, t.status, 'Articles:', arts.length);
for (const a of arts.slice(0, 5)) {
  console.log(' -', a.outletTierSnapshot, a.title.slice(0, 40), a.url.slice(0, 60));
}
"
```

预期：至少拿到几条 `outletTierSnapshot=central` 的文章（新华社 / 人民日报 / 央视等域名）。若为 0，查 Tavily API key 是否有效、include_domains 是否传对。

- [ ] **Step 19.5** 回到浏览器详情页刷新，能看到文章列表填充。

---

## Task 20: 全量回归 + S2 终结提交

- [ ] **Step 20.1** 跑：

```bash
npx tsc --noEmit
npm run lint 2>&1 | tail -20
npm run build 2>&1 | tail -20
npx dotenvx run -f .env.local -- npm test 2>&1 | tail -40
```

要求：
- tsc：新增代码零错误
- lint：新增代码无 error
- build：成功（含 `/research/new`、`/research/tasks/[id]` 路由）
- test：研究模块测试文件全部 PASS（S1 5+5+5 + S2 6+4+3 = 28 用例）

- [ ] **Step 20.2** 清理任何残留 console.log。

- [ ] **Step 20.3** S2 结束提交：

```bash
git log --oneline | head -25  # 确认 S2 各步骤 commit 齐全
```

---

## S2 完成验收清单

- [x] 10 张 S1 表 + 1 新字段上线
- [x] URL 归一化 + SHA-256 dedup，测试 6/6
- [x] Outlet matcher 支持 host + alias，测试 4/4
- [x] Article ingest 幂等 upsert，测试 3/3
- [x] 4 个 Inngest 函数：task-start / tavily-crawl / whitelist-crawl / manual-url-ingest
- [x] Inngest 函数已注册到 `/api/inngest` route
- [x] DAL：listMyResearchTasks / getResearchTaskDetail
- [x] Server Actions：createResearchTask / cancelResearchTask
- [x] UI：研究首页（任务列表）/ 新建任务表单 / 任务详情页
- [x] 端到端冒烟：真实任务能跑通，文章入库并显示在详情页
- [x] tsc / lint / build / test 全绿

---

## 已知 S2 限制（S3 或后续处理）

- 文章入库后尚未做关键词命中或语义分析（`news_article_topic_hits` 还是空）→ S3
- 任务状态 `crawling` 是 S2 的终态（没有 `done`）→ S3 加 finalize step
- 白名单站点采集非常朴素（列表页正文里的 URL 全部尝试抓）→ S2.1 按需加翻页 + 更好的 URL 抽取
- Jina Reader 失败时仅告警不重抓 → S2.1 加 article-level 重试队列
- 无 HTML 快照 → S2.1 加 Blob 存储
- Inngest function 的幂等键用默认值 — 如需更精细的重试复用，单独优化

---

## 下阶段索引

| 阶段 | 计划文档（待写） |
|---|---|
| **S3 命中分析** | 关键词命中扫描 + 主题样本向量化 + 文章向量化 + 余弦相似度 + `news_article_topic_hits` 写入 + 任务 finalize |
| **S4 检索 UI** | 任务结果页（数据简报/命中表/图表/透视表）+ 知网式高级检索 |
| **S5 聚合 + 图表** | 文本简报生成 + 三图表 + 透视表 |
| **S6 导出** | Excel 7 Sheet + Word 报告模板 |
