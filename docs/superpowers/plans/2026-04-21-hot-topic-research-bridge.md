# 热榜采集 → 新闻研究工作台桥接 实施计划

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.
> 本仓库强制单分支开发（CLAUDE.md）—— 所有 commit 直接落在 `main`，每个 Phase 必须保持 build 可通过。

**Goal:** 让 collection-hub 的热榜采集数据（`__system_hot_topic_crawler__` / 微博等）按源级别开关桥接到 `research_news_articles`，供新闻研究工作台全文检索。

**Architecture:** 订阅现有 `collection/item.created` 事件 → 独立 Inngest 函数按 `research_bridge_enabled` flag 过滤 → 走 `ingestArticle()` upsert → 发 `research/article.content-fetch` 事件 → 异步 Jina Reader 拉正文回填。历史数据由一次性 backfill 函数分批派事件复用主链路。

**Tech Stack:** Drizzle + Supabase Postgres · Inngest · Jina Reader · Vitest · Next.js 16 App Router

**Reference:**
- Spec: `docs/superpowers/specs/2026-04-21-hot-topic-research-bridge-design.md`
- 事件名**修正**：spec 写 `collection/item.ingested`，实际仓库用 `collection/item.created`（见 `src/inngest/events.ts:228`）—— 以代码为准

---

## Phase 1 — Schema 变更 + Migration

每个 enum 值 `ADD VALUE` 都必须单独执行，不能和其它 DDL 放同一事务（Drizzle 会自动拆），手工校验一下。

### Task 1.1: 扩展 `newsSourceChannelEnum` 新增 `hot_topic_crawler`

**Files:**
- Modify: `src/db/schema/research/enums.ts`

- [ ] **Step 1: 修改 enum 定义**

```ts
// src/db/schema/research/enums.ts
export const newsSourceChannelEnum = pgEnum("research_news_source_channel", [
  "tavily",
  "whitelist_crawl",
  "manual_url",
  "hot_topic_crawler",  // 新增
]);
```

- [ ] **Step 2: 同步注释**

enum 注释块加一行：`hot_topic_crawler: 热榜采集（collection-hub 桥接）`。

### Task 1.2: 扩展 `mediaTierEnum` 新增 `self_media`

**Files:**
- Modify: `src/db/schema/research/enums.ts`

- [ ] **Step 1: 修改 enum 定义**

```ts
export const mediaTierEnum = pgEnum("research_media_tier", [
  "central",
  "provincial_municipal",
  "industry",
  "district_media",
  "self_media",  // 新增
]);
```

- [ ] **Step 2: 注释加一条**：`self_media: 自媒体/热榜平台（微博、知乎、B站等），由 collection-hub 桥接`。

### Task 1.3: `collection_sources` 加 `researchBridgeEnabled` 字段

**Files:**
- Modify: `src/db/schema/collection.ts`

- [ ] **Step 1: 在 `collectionSources` pgTable 内加字段**

在 `deletedAt` 之前插入：

```ts
researchBridgeEnabled: boolean("research_bridge_enabled").notNull().default(false),
```

### Task 1.4: `research_news_articles` 加 `contentFetchStatus` 字段

**Files:**
- Modify: `src/db/schema/research/news-articles.ts`

- [ ] **Step 1: 字段定义**

在 `embeddingStatus` 下方加：

```ts
contentFetchStatus: text("content_fetch_status").notNull().default("pending"),
```

字段值约定（写成 JSDoc 注释）：`pending | fetching | done | failed | skipped`。

### Task 1.5: 生成并校验 migration

- [ ] **Step 1: 生成 migration 文件**

Run: `npm run db:generate`
Expected: `supabase/migrations/<timestamp>_*.sql` 生成新文件。

- [ ] **Step 2: 打开文件检查 SQL**

必须包含：
- `ALTER TYPE research_news_source_channel ADD VALUE 'hot_topic_crawler';`
- `ALTER TYPE research_media_tier ADD VALUE 'self_media';`
- `ALTER TABLE collection_sources ADD COLUMN research_bridge_enabled boolean NOT NULL DEFAULT false;`
- `ALTER TABLE research_news_articles ADD COLUMN content_fetch_status text NOT NULL DEFAULT 'pending';`

若 Drizzle 把两个 `ALTER TYPE ADD VALUE` 放在同一个 migration statement 里，手工拆成两个 statement（PG 规定 `ADD VALUE` 必须是事务中第一个也是唯一一个 statement）。

- [ ] **Step 3: 补一条回填 SQL**

手工在 migration 末尾追加：

```sql
-- Existing rows with content are done (Tavily/whitelist/manual already fetched content)
UPDATE research_news_articles SET content_fetch_status = 'done' WHERE content IS NOT NULL;
```

- [ ] **Step 4: 应用到本地 Supabase**

Run: `npm run db:push`
Expected: 打印已应用变更，无错误。

- [ ] **Step 5: 在 Drizzle Studio 验证**

Run: `npm run db:studio`，打开后查：
- `collection_sources` 多了 `research_bridge_enabled` 列，默认 false
- `research_news_articles` 多了 `content_fetch_status` 列
- enum 值生效（可通过 `SELECT unnest(enum_range(NULL::research_media_tier))` 查）

- [ ] **Step 6: Commit**

```bash
git add src/db/schema supabase/migrations
git commit -m "feat(db): 热榜桥接 schema — enum 扩值 + research_bridge_enabled flag + content_fetch_status"
```

---

## Phase 2 — 桥接主函数

### Task 2.1: 新增 Inngest 事件类型

**Files:**
- Modify: `src/inngest/events.ts`

- [ ] **Step 1: 在 events.ts 末尾或合适位置加两个事件**

```ts
// ─── Research Bridge Events (2026-04-21) ───

"research/article.content-fetch": {
  data: {
    articleId: string;
    url: string;
  };
};

"research/bridge.backfill.trigger": {
  data: {
    organizationId?: string;
    limit?: number;
  };
};
```

- [ ] **Step 2: tsc 检查**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 无报错（或仅预先存在的无关错误）。

### Task 2.2: 写 bridge 核心逻辑（先测试）

**Files:**
- Create: `src/lib/collection/bridge-research.ts`
- Create: `src/lib/collection/__tests__/bridge-research.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/collection/__tests__/bridge-research.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  organizations,
  collectionSources,
  collectedItems,
} from "@/db/schema";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq } from "drizzle-orm";
import { bridgeCollectedItemToResearch } from "../bridge-research";

describe("bridgeCollectedItemToResearch", () => {
  const orgId = randomUUID();
  let sourceId: string;
  let itemId: string;

  beforeEach(async () => {
    await db.insert(organizations).values({
      id: orgId, name: "bridge-test-org", slug: `bridge-${Date.now()}`,
    }).onConflictDoNothing();

    const [src] = await db.insert(collectionSources).values({
      organizationId: orgId,
      name: "test-hot-topic-src",
      sourceType: "tophub",
      config: { platforms: ["weibo"] },
      targetModules: ["hot_topics"],
      researchBridgeEnabled: true,
    }).returning();
    sourceId = src.id;

    const url = `https://weibo.com/test-${randomUUID()}`;
    const [item] = await db.insert(collectedItems).values({
      organizationId: orgId,
      contentFingerprint: `fp-${randomUUID()}`,
      canonicalUrl: url,
      title: "测试热榜条目",
      firstSeenSourceId: sourceId,
      firstSeenChannel: "tophub",
      firstSeenAt: new Date(),
      sourceChannels: [{ channel: "tophub", url, sourceId, runId: "r1", capturedAt: new Date().toISOString() }],
      platforms: ["weibo"],
    }).returning();
    itemId = item.id;
  });

  afterEach(async () => {
    await db.delete(newsArticles).where(eq(newsArticles.rawMetadata, { collectedItemId: itemId } as never)).catch(() => {});
    await db.delete(collectedItems).where(eq(collectedItems.id, itemId));
    await db.delete(collectionSources).where(eq(collectionSources.id, sourceId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  });

  it("inserts research_news_article when source flag is true", async () => {
    const result = await bridgeCollectedItemToResearch(itemId, orgId);
    expect(result.skipped).toBe(false);
    expect(result.inserted).toBe(true);
    expect(result.articleId).toBeTruthy();

    const [article] = await db.select().from(newsArticles).where(eq(newsArticles.id, result.articleId!));
    expect(article.sourceChannel).toBe("hot_topic_crawler");
    expect(article.outletTierSnapshot).toBe("self_media");
    expect(article.contentFetchStatus).toBe("pending");
    expect(article.content).toBeNull();
  });

  it("skips when source flag is false", async () => {
    await db.update(collectionSources).set({ researchBridgeEnabled: false }).where(eq(collectionSources.id, sourceId));
    const result = await bridgeCollectedItemToResearch(itemId, orgId);
    expect(result.skipped).toBe(true);
  });

  it("is idempotent on same url_hash", async () => {
    await bridgeCollectedItemToResearch(itemId, orgId);
    const second = await bridgeCollectedItemToResearch(itemId, orgId);
    expect(second.inserted).toBe(false);
    expect(second.articleId).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/collection/__tests__/bridge-research.test.ts 2>&1 | tail -20`
Expected: 报 `Cannot find module '../bridge-research'` 或类似。

- [ ] **Step 3: 写实现**

```ts
// src/lib/collection/bridge-research.ts
import { db } from "@/db";
import { collectedItems, collectionSources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ingestArticle } from "@/lib/research/article-ingest";

export interface BridgeResearchResult {
  skipped: boolean;
  reason?: string;
  inserted: boolean;
  articleId: string | null;
}

/**
 * 把 collected_items 一行桥接到 research_news_articles。
 * - 必须源上 research_bridge_enabled === true
 * - 复用 ingestArticle() 的 url_hash upsert（幂等）
 * - tier 回落 self_media；outlet/district 由 matchOutletForUrl 填
 * - content 留 null，content_fetch_status = 'pending'（由异步 fetch 函数补）
 *
 * 不 throw；skip 和 duplicate 都返回结构化结果。
 */
export async function bridgeCollectedItemToResearch(
  itemId: string,
  organizationId: string,
): Promise<BridgeResearchResult> {
  const [item] = await db
    .select()
    .from(collectedItems)
    .where(eq(collectedItems.id, itemId))
    .limit(1);
  if (!item) {
    return { skipped: true, reason: "item-not-found", inserted: false, articleId: null };
  }
  if (!item.firstSeenSourceId) {
    return { skipped: true, reason: "no-source", inserted: false, articleId: null };
  }

  const [source] = await db
    .select({ researchBridgeEnabled: collectionSources.researchBridgeEnabled })
    .from(collectionSources)
    .where(eq(collectionSources.id, item.firstSeenSourceId))
    .limit(1);
  if (!source?.researchBridgeEnabled) {
    return { skipped: true, reason: "flag-disabled", inserted: false, articleId: null };
  }

  const url = item.canonicalUrl;
  if (!url) {
    return { skipped: true, reason: "no-url", inserted: false, articleId: null };
  }

  const result = await ingestArticle({
    url,
    title: item.title,
    content: null,
    publishedAt: item.publishedAt ?? item.firstSeenAt,
    sourceChannel: "hot_topic_crawler",
    organizationId,
    rawMetadata: {
      collectedItemId: item.id,
      sourceChannels: item.sourceChannels,
      platforms: item.platforms,
      bridgeVersion: "v1",
    },
  });

  return {
    skipped: false,
    inserted: result.inserted,
    articleId: result.id,
  };
}
```

- [ ] **Step 4: 扩展 ingestArticle 接受 hot_topic_crawler + 可选 null content**

检查 `src/lib/research/article-ingest.ts` 的 `ArticleIngestInput` 类型，`sourceChannel` 现在是 `"tavily" | "whitelist_crawl" | "manual_url"`。需要加 `"hot_topic_crawler"`：

```ts
sourceChannel: "tavily" | "whitelist_crawl" | "manual_url" | "hot_topic_crawler";
```

`content?: string | null` —— 当前是 `content?: string`，改为可选或 null。

- [ ] **Step 5: 跑测试直到全绿**

Run: `npx vitest run src/lib/collection/__tests__/bridge-research.test.ts 2>&1 | tail -15`
Expected: 3 passed。

- [ ] **Step 6: Commit**

```bash
git add src/lib/collection/bridge-research.ts src/lib/collection/__tests__/bridge-research.test.ts src/lib/research/article-ingest.ts
git commit -m "feat(research): bridgeCollectedItemToResearch — 核心桥接逻辑 + tests"
```

### Task 2.3: 写 Inngest bridge 函数

**Files:**
- Create: `src/inngest/functions/collection/research-bridge.ts`
- Modify: `src/inngest/functions/collection/index.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 1: 写 Inngest 函数**

```ts
// src/inngest/functions/collection/research-bridge.ts
import { inngest } from "@/inngest/client";
import { bridgeCollectedItemToResearch } from "@/lib/collection/bridge-research";

/**
 * Subscriber: 和 collectionHotTopicBridge 并列订阅 collection/item.created。
 * 当源开启 researchBridgeEnabled 时把 item 桥接到 research_news_articles，
 * 然后派发 research/article.content-fetch 事件让 Jina 异步拉正文。
 */
export const collectionResearchBridge = inngest.createFunction(
  {
    id: "collection-research-bridge",
    name: "Collection Hub - Research Bridge",
    concurrency: { limit: 4 },
    retries: 2,
  },
  { event: "collection/item.created" },
  async ({ event, step }) => {
    const { itemId, organizationId } = event.data;

    const result = await step.run("bridge-to-research", () =>
      bridgeCollectedItemToResearch(itemId, organizationId),
    );

    if (result.skipped) {
      return { skipped: true, reason: result.reason };
    }

    if (result.inserted && result.articleId) {
      // Fire async content-fetch event (no await, event is decoupled)
      await step.sendEvent("fire-content-fetch", {
        name: "research/article.content-fetch",
        data: {
          articleId: result.articleId,
          url: event.data.firstSeenChannel
            ? "" // placeholder — fetch fn reads URL from DB
            : "",
        },
      });
    }

    return {
      itemId,
      articleId: result.articleId,
      inserted: result.inserted,
    };
  },
);
```

注：`url` 字段在事件里传空也 OK——content-fetch 函数自己会从 DB 按 articleId 读 URL（Step 3.2 里实现）。

- [ ] **Step 2: 注册函数**

修改 `src/inngest/functions/collection/index.ts` 加一行 export：

```ts
export { collectionResearchBridge } from "./research-bridge";
```

修改 `src/inngest/functions/index.ts`：
- 在 import 块里加 `collectionResearchBridge`
- 在 `functions` array 的 Collection Hub 段里加 `collectionResearchBridge`

- [ ] **Step 3: tsc + 启动 dev server 验证 inngest endpoint**

Run: `npx tsc --noEmit 2>&1 | grep -i error | head -5`
Expected: 无新错误。

（手测可后置到 Phase 6 一起做。）

- [ ] **Step 4: Commit**

```bash
git add src/inngest/functions/collection/research-bridge.ts src/inngest/functions/collection/index.ts src/inngest/functions/index.ts src/inngest/events.ts
git commit -m "feat(inngest): collectionResearchBridge + research/article.content-fetch 事件类型"
```

---

## Phase 3 — 异步正文拉取

### Task 3.1: 确认 web-fetch 可复用

**Files:**
- Read: `src/lib/web-fetch.ts`

- [ ] **Step 1: 阅读现有 Jina Reader 封装**

检查导出的函数签名（应该有一个 `fetchArticleContent` 或类似的，返回 `{ content, publishedAt? }`）。如果现成 API 够用直接用；如果没有，可在本 Phase 后补。

### Task 3.2: 写 content-fetch Inngest 函数（先测试）

**Files:**
- Create: `src/lib/research/content-fetch.ts` （纯函数，方便测）
- Create: `src/lib/research/__tests__/content-fetch.test.ts`
- Create: `src/inngest/functions/research/article-content-fetch.ts`
- Modify: `src/inngest/functions/research/index.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 1: 写纯函数测试**

```ts
// src/lib/research/__tests__/content-fetch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAndUpdateArticleContent } from "../content-fetch";

vi.mock("@/lib/web-fetch", () => ({
  fetchArticleContent: vi.fn(),
}));

describe("fetchAndUpdateArticleContent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates content and sets status=done on success", async () => {
    // Setup mock DB row + mock web-fetch success
    // Assert: article.content updated, status = 'done'
  });

  it("marks status=failed on fetch error", async () => {
    // Setup mock web-fetch that throws
    // Assert: status = 'failed', raw_metadata.contentFetchError populated
  });

  it("is no-op if content_fetch_status is already done", async () => {
    // Assert: no db update
  });
});
```

（详细实现在 step 3 之后。测试骨架先占位，用真 DB 集成测试；若觉得 mock 太重可以直接跑真 Jina Reader + 测试 URL。）

- [ ] **Step 2: 写纯函数**

```ts
// src/lib/research/content-fetch.ts
import { db } from "@/db";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq } from "drizzle-orm";
import { fetchArticleContent } from "@/lib/web-fetch";

export async function fetchAndUpdateArticleContent(articleId: string): Promise<{
  status: "done" | "skipped" | "failed";
  error?: string;
}> {
  const [row] = await db
    .select({
      url: newsArticles.url,
      contentFetchStatus: newsArticles.contentFetchStatus,
      rawMetadata: newsArticles.rawMetadata,
    })
    .from(newsArticles)
    .where(eq(newsArticles.id, articleId))
    .limit(1);
  if (!row) return { status: "failed", error: "article not found" };
  if (row.contentFetchStatus === "done") return { status: "skipped" };

  await db
    .update(newsArticles)
    .set({ contentFetchStatus: "fetching" })
    .where(eq(newsArticles.id, articleId));

  try {
    const { content, publishedAt } = await fetchArticleContent(row.url);
    await db
      .update(newsArticles)
      .set({
        content,
        publishedAt: publishedAt ?? undefined,
        contentFetchStatus: "done",
      })
      .where(eq(newsArticles.id, articleId));
    return { status: "done" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .update(newsArticles)
      .set({
        contentFetchStatus: "failed",
        rawMetadata: { ...(row.rawMetadata as Record<string, unknown> ?? {}), contentFetchError: msg },
      })
      .where(eq(newsArticles.id, articleId));
    return { status: "failed", error: msg };
  }
}
```

如果 `src/lib/web-fetch.ts` 的导出名不是 `fetchArticleContent`，用实际的名字（例如 `jinaReaderFetch`），并转换返回结构。

- [ ] **Step 3: 写 Inngest 包装函数**

```ts
// src/inngest/functions/research/article-content-fetch.ts
import { inngest } from "@/inngest/client";
import { fetchAndUpdateArticleContent } from "@/lib/research/content-fetch";

export const researchArticleContentFetch = inngest.createFunction(
  {
    id: "research-article-content-fetch",
    name: "Research - Article Content Fetch (Jina)",
    concurrency: { limit: 3 },  // Jina 配额保护
    retries: 3,
  },
  { event: "research/article.content-fetch" },
  async ({ event, step }) => {
    const { articleId } = event.data;
    const result = await step.run("fetch", () =>
      fetchAndUpdateArticleContent(articleId),
    );
    if (result.status === "failed") {
      // throw 让 Inngest retry
      throw new Error(result.error ?? "content fetch failed");
    }
    return result;
  },
);
```

- [ ] **Step 4: 注册到 research index**

`src/inngest/functions/research/index.ts` 加：

```ts
export { researchArticleContentFetch } from "./article-content-fetch";
```

`src/inngest/functions/index.ts`：
- import 块里从 `./research` 加 `researchArticleContentFetch`
- functions array 的 Research 段末尾加 `researchArticleContentFetch`

- [ ] **Step 5: 跑测试**

Run: `npx vitest run src/lib/research/__tests__/content-fetch.test.ts 2>&1 | tail -15`
Expected: 3 passed（根据实际 mock 覆盖情况调整）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/research/content-fetch.ts src/lib/research/__tests__/content-fetch.test.ts src/inngest/functions/research/article-content-fetch.ts src/inngest/functions/research/index.ts src/inngest/functions/index.ts
git commit -m "feat(research): 异步正文拉取 — fetchAndUpdateArticleContent + Inngest 包装"
```

---

## Phase 4 — 历史数据 Backfill

### Task 4.1: 写 backfill 函数

**Files:**
- Create: `src/inngest/functions/research/bridge-backfill.ts`
- Modify: `src/inngest/functions/research/index.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 1: 写函数**

```ts
// src/inngest/functions/research/bridge-backfill.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems, collectionSources } from "@/db/schema";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq, and, sql } from "drizzle-orm";
import { hashUrl } from "@/lib/research/url-hash";

const BATCH_SIZE = 50;

export const researchBridgeBackfill = inngest.createFunction(
  {
    id: "research-bridge-backfill",
    name: "Research - Bridge Backfill (one-shot)",
    concurrency: { limit: 1 },
  },
  { event: "research/bridge.backfill.trigger" },
  async ({ event, step }) => {
    const { organizationId, limit } = event.data;

    // Fetch unbridged items: joined on enabled sources, filter out those with
    // a url already in research_news_articles (dedup check).
    const items = await step.run("scan-unbridged", async () => {
      const whereOrg = organizationId
        ? sql`ci.organization_id = ${organizationId}`
        : sql`TRUE`;
      const batchLimit = limit ?? 500;  // cap scan size per trigger

      // 子查询排除已桥接（url_hash 在 research_news_articles 里已存在）
      const rows = await db.execute<{ id: string; org_id: string; canonical_url: string }>(sql`
        SELECT ci.id, ci.organization_id AS org_id, ci.canonical_url
        FROM collected_items ci
        JOIN collection_sources cs ON cs.id = ci.first_seen_source_id
        WHERE cs.research_bridge_enabled = true
          AND ci.canonical_url IS NOT NULL
          AND ${whereOrg}
          AND NOT EXISTS (
            SELECT 1 FROM research_news_articles rna WHERE rna.url_hash = md5(ci.canonical_url)
          )
        LIMIT ${batchLimit}
      `);
      return rows.rows;
    });

    if (items.length === 0) return { bridged: 0 };

    // Fan-out in batches of BATCH_SIZE
    const batches: typeof items[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    for (const [idx, batch] of batches.entries()) {
      await step.sendEvent(`fan-out-${idx}`, batch.map((item) => ({
        name: "collection/item.created" as const,
        data: {
          itemId: item.id,
          sourceId: "",  // bridge fn reads source from collected_items.first_seen_source_id
          organizationId: item.org_id,
          targetModules: [],
          firstSeenChannel: "",
        },
      })));
    }

    return { bridged: items.length, batches: batches.length };
  },
);
```

**注意 `hashUrl` 要和 DAL 一致**：看 `src/lib/research/url-hash.ts` 用的是否是 `md5`。如果是 sha256 等别的算法，把 SQL 里 `md5(...)` 换成一致的表达式，或改成 client-side 先算好再传。保险做法：先读 `src/lib/research/url-hash.ts` 确认。

- [ ] **Step 2: 读 url-hash.ts 对齐**

Run: `cat src/lib/research/url-hash.ts`
- 若它用 SHA-256 等 PG 没直接对应的，改 SQL 为先 SELECT 所有候选到 JS 再 JS 侧过滤；或改用 pgcrypto 的 `digest(ci.canonical_url, 'sha256')`。
- 确认后更新上一步的 SQL。

- [ ] **Step 3: 注册函数**

`src/inngest/functions/research/index.ts`:
```ts
export { researchBridgeBackfill } from "./bridge-backfill";
```

`src/inngest/functions/index.ts` functions array:
```ts
researchBridgeBackfill,
```

- [ ] **Step 4: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -i error | head -5`
Expected: 无新错。

- [ ] **Step 5: Commit**

```bash
git add src/inngest/functions/research/bridge-backfill.ts src/inngest/functions/research/index.ts src/inngest/functions/index.ts
git commit -m "feat(research): bridge-backfill 一次性桥接存量 collected_items"
```

---

## Phase 5 — UI 与 DAL 更新

### Task 5.1: DAL 返回 platform fallback

**Files:**
- Modify: `src/lib/dal/research/news-article-search.ts`

- [ ] **Step 1: `ArticleSearchResult` 类型加字段**

```ts
export type ArticleSearchResult = {
  // ...existing fields
  platformFallback: string | null;
};
```

- [ ] **Step 2: 两处 search 函数都返回 `rawMetadata`**

`searchNewsArticles` 和 `advancedSearchNewsArticles` 的 `db.select({...}).from(newsArticles)` 加 `rawMetadata: newsArticles.rawMetadata`。

- [ ] **Step 3: map 时从 rawMetadata 取 platforms[0]**

```ts
const articles: ArticleSearchResult[] = rows.map((r) => ({
  // ...existing
  platformFallback: extractPlatform(r.rawMetadata),
}));

function extractPlatform(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const platforms = (raw as { platforms?: string[] }).platforms;
  return platforms?.[0] ?? null;
}
```

两个函数都改。

### Task 5.2: 搜索工作台加新选项 + 空字段兜底

**Files:**
- Modify: `src/app/(dashboard)/research/search-workbench-client.tsx`

- [ ] **Step 1: 加 CHANNEL_OPTIONS / CHANNEL_LABELS**

```ts
const CHANNEL_OPTIONS = [
  { value: "tavily", label: "全网搜索" },
  { value: "whitelist_crawl", label: "白名单" },
  { value: "manual_url", label: "手工URL" },
  { value: "hot_topic_crawler", label: "热榜采集" },  // 新
];

const CHANNEL_LABELS: Record<string, string> = {
  tavily: "全网搜索",
  whitelist_crawl: "白名单",
  manual_url: "手工URL",
  hot_topic_crawler: "热榜采集",  // 新
};
```

- [ ] **Step 2: 加 TIER_OPTIONS / TIER_LABELS / TIER_BADGE_CLASS**

```ts
const TIER_OPTIONS = [
  ...existing,
  { value: "self_media", label: "自媒体/热榜" },
];

const TIER_BADGE_CLASS = {
  ...existing,
  self_media: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

const TIER_LABELS = {
  ...existing,
  self_media: "自媒体/热榜",
};
```

- [ ] **Step 3: 媒体名列兜底**

DataTable 的 `outlet` 列 render：

```tsx
render: (a) => (
  <span className="text-muted-foreground truncate block">
    {a.outletName ?? a.platformFallback ?? "-"}
  </span>
),
```

### Task 5.3: 其他页面 TIER_LABELS 同步

**Files:**
- Modify: `src/app/(dashboard)/research/admin/tasks/[id]/task-detail-client.tsx`
- Modify: `src/app/(dashboard)/research/admin/media-outlets/media-outlets-client.tsx`

- [ ] **Step 1: 两个文件的 TIER_LABELS / TIER_BADGE_CLASS 都加 `self_media` 条目**

用和 Task 5.2 相同的 label / badge class，避免 UI 遇到 self_media 没有映射时崩坏。

- [ ] **Step 2: `new-task-client.tsx` 故意不加**

检查 `src/app/(dashboard)/research/admin/tasks/new/new-task-client.tsx` 的 `TIERS` 常量——**保持现状不加 self_media**（spec 决策：研究任务创建不应主动选自媒体）。

### Task 5.4: 采集源设置加勾选框

**Files:**
- Modify: `/collection-hub/settings` 源编辑表单（需先定位文件）

- [ ] **Step 1: 找到源编辑组件**

Run: `grep -rn "researchBridgeEnabled\|target_modules" src/app/\(dashboard\)/collection-hub 2>/dev/null | head -10`
找到源编辑 Dialog / 表单文件路径。

- [ ] **Step 2: 表单字段 + Checkbox 控件**

在 form state 里加：
```ts
researchBridgeEnabled: boolean;
```

UI 加 Checkbox：
```tsx
<div className="flex items-start gap-2">
  <Checkbox
    checked={form.researchBridgeEnabled}
    onCheckedChange={(v) => setForm(f => ({ ...f, researchBridgeEnabled: !!v }))}
  />
  <div className="space-y-1">
    <Label>同步到研究工作台</Label>
    <p className="text-xs text-muted-foreground">
      勾选后，该源采集到的数据会自动进入新闻研究工作台，供全文检索和媒体层级分析使用
    </p>
  </div>
</div>
```

- [ ] **Step 3: server action 透传字段**

找到对应的 createSource / updateSource server action（可能在 `src/app/actions/collection/`），把 `researchBridgeEnabled` 加到 schema validation + insert/update 值里。

- [ ] **Step 4: tsc + 手测**

Run: `npx tsc --noEmit 2>&1 | grep -i error | head -5`
新建一个测试源，勾选框状态能保存并读回。

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/collection-hub src/app/actions/collection src/lib/dal/research src/app/\(dashboard\)/research
git commit -m "feat(ui): 研究工作台新增热榜渠道/自媒体层级选项 + 采集源设置同步到研究工作台勾选框"
```

---

## Phase 6 — Seed 与上线验证

### Task 6.1: 把系统源的 flag 默认打开

**Files:**
- Modify: `src/lib/collection/seed-system-sources.ts`

- [ ] **Step 1: `ensureHotTopicSystemSource` 里加 flag**

update 和 insert 分支都加：
```ts
researchBridgeEnabled: true,
```

- [ ] **Step 2: 手工对已有用户跑一条 UPDATE**

把微博相关源也打开（seed 脚本可能没覆盖用户手动建的微博源）。打开 Drizzle Studio 或连 PG，跑：
```sql
UPDATE collection_sources SET research_bridge_enabled = true
WHERE name LIKE '%微博%' OR name = '__system_hot_topic_crawler__';
```

（或者写成一个一次性脚本 `scripts/enable-research-bridge-for-existing-sources.ts`，便于后续新环境复制。）

- [ ] **Step 3: Commit**

```bash
git add src/lib/collection/seed-system-sources.ts
git commit -m "feat(seed): __system_hot_topic_crawler__ 默认开启 researchBridgeEnabled"
```

### Task 6.2: 端到端手测

- [ ] **Step 1: 启动 dev server**

Run: `npm run dev`

- [ ] **Step 2: 触发一次热榜采集**

手工进到 `/inspiration` 或 `/home` 的"刷新数据"，或直接调 inspiration crawl API，确认：
- `collected_items` 有新行
- `research_news_articles` 也有新行（status=pending）
- 等 Inngest Jina 队列跑完（Inngest dashboard `/api/inngest` 看进度），`content_fetch_status=done`，`content` 非空

- [ ] **Step 3: 触发一次 backfill**

在 Node REPL 或一个临时脚本里发事件：
```ts
await inngest.send({ name: "research/bridge.backfill.trigger", data: { organizationId: "<你的 org>" } });
```

到 Drizzle Studio 看 `research_news_articles` 行数对应增加。

- [ ] **Step 4: 前端验证**

打开 `/research`，默认就能看到最新数据。筛选 "采集来源=热榜采集"、"媒体层级=自媒体/热榜" 各自应有数据。

- [ ] **Step 5: 反向验证 flag 生效**

到 `/collection-hub/settings` 建一个新源，**不勾选**同步到研究工作台，跑一次采集，确认 `collected_items` 有新行但 `research_news_articles` **没有**对应新行。

- [ ] **Step 6: Commit 手测记录**

如果发现 bug 修完：
```bash
git add <修的文件>
git commit -m "fix(bridge): <具体问题描述>"
```

---

## 风险与回滚

- **Jina Reader 配额爆**：暂时手工把 `content-fetch` 函数并发降到 1 或 pause；状态 `failed` 的行可以手动筛出来慢慢重跑
- **Enum migration 失败**：回滚 migration（`supabase/migrations/` 新文件删掉 + `db:push` 重跑）；enum ADD VALUE 无法 ROLLBACK，需用 `ALTER TYPE ... RENAME VALUE` 或直接保留
- **大量脏数据进研究库**：关闭对应源的 `researchBridgeEnabled` flag，然后 `DELETE FROM research_news_articles WHERE source_channel='hot_topic_crawler'`
