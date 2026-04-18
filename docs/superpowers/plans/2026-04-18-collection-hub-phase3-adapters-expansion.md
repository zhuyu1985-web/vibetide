# Collection Hub · Phase 3 Adapter 扩展 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 新增 2 个采集 Adapter（`list_scraper` 融合正则/CSS选择器两种模式 + `rss` Atom/RSS 订阅）,让运营可以在后台自助添加**任意站点列表抓取**和**任意 RSS 订阅**作为采集源。Phase 3 只做 Adapter 本体,**不迁移研究任务 / benchmarking / 不做内容浏览页**——那些推到 Phase 4+。

**Architecture:** 沿用 Phase 0 奠定的 `SourceAdapter` 插件契约,每个新 Adapter 实现 `execute()` + 声明 `configSchema`+ `configFields`。新 Adapter 注册进 Registry,自动在后台"新建源"向导里作为可选类型出现,零 UI 改动。

**Tech Stack:** Next.js 16、Drizzle、Zod 4、`cheerio` 1.2.0（已在 deps,用于 CSS 选择器抓取 + RSS XML 解析,避免引入新依赖）、`fetchWithPolicy`（Phase 0）+ `fetchViaJinaReader`（既有深读）。

**Phase 3 范围说明：**
- ✅ 含：`list_scraper` Adapter + `rss` Adapter + Registry 注册
- ⏸️ **推到 Phase 4**：研究任务 3 分支迁移、benchmarking 迁移、内容浏览页 + 监控面板
- 推迟理由：研究任务迁移只有在内容浏览页（Phase 4）落地后才产生用户可见价值,独立做等于隐形代码改动

**依赖前置：**
- Phase 0 + Phase 1 + Phase 2 完成（最新 commit `fcc9fb1`）
- Registry + `fetchWithPolicy` + `fetchViaJinaReader` 工作

**Phase 3 验收标准：**
- `/data-collection/sources/new` 向导里出现 5 张类型卡：TopHub / Tavily / Jina URL / **列表抓取(list_scraper)** / **RSS 订阅(rss)**
- 用 list_scraper（regex 模式）+ 新华网列表页做 smoke：`listUrl=https://www.xinhuanet.com/politics/`,`articleUrlPattern=/\d{4}-\d{2}/\d{2}/` → 应能抓到当日政治新闻列表
- 用 rss + 虎嗅 RSS（`https://www.huxiu.com/rss/0.xml` 或任意公开 feed）→ 应能抓到最新 10-20 条
- `npm run test` 通过（新增 list_scraper 和 rss 的单测）
- `npm run build` + `npx tsc --noEmit` 全绿

**关联文档：**
- Spec: `docs/superpowers/specs/2026-04-18-unified-collection-module-design.md` (Section 7 Adapter 契约)
- Phase 2 plan: `docs/superpowers/plans/2026-04-18-collection-hub-phase2-hot-topic-migration.md`

---

## 文件结构总览

### 新建
- `src/lib/collection/adapters/list-scraper.ts` — 列表抓取 Adapter
- `src/lib/collection/adapters/rss.ts` — RSS Adapter
- `src/lib/collection/adapters/__tests__/list-scraper.test.ts`
- `src/lib/collection/adapters/__tests__/rss.test.ts`

### 修改
- `src/lib/collection/adapters/index.ts` — 追加注册新 Adapter

### 不动
- 所有既有 Adapter
- 后台向导 UI（自动从 Registry 发现新 Adapter）
- 研究任务、benchmarking、hot-topic-bridge

---

## Task 1: `list_scraper` Adapter — 列表抓取（融合 regex + CSS 两种模式）

**Files:**
- Create: `src/lib/collection/adapters/list-scraper.ts`
- Test: `src/lib/collection/adapters/__tests__/list-scraper.test.ts`

### 设计

config 形态：

```ts
{
  listUrl: string (url),
  extractMode: "regex" | "css",

  // regex 模式专用:列表页全文中匹配的文章 URL 模式
  articleUrlPattern?: string,  // 正则表达式字符串

  // css 模式专用:CSS 选择器
  selectors?: {
    items: string,      // 每条文章卡的容器选择器,如 ".article-card"
    title: string,      // 相对于 items 的标题选择器
    link: string,       // 相对于 items 的链接选择器(href 属性)
    date?: string,      // 可选:发布时间选择器
    summary?: string,   // 可选:摘要选择器
  },

  maxArticlesPerRun?: number,  // 默认 10
  fetchFullContent?: boolean,  // 默认 false(只收列表级元数据,深读留给手工 jina_url 源)
}
```

**关键逻辑：**

- **regex 模式**：
  1. 用 `fetchViaJinaReader(listUrl)` 拉取列表页的 Markdown（Jina 会把 HTML 结构转成干净的 Markdown,正文中的链接保留为 `[text](url)` 形式）
  2. 用提供的正则从 Markdown 中抽出 URL + 链接文本
  3. 取前 N（`maxArticlesPerRun`）条
  4. 若 `fetchFullContent=true`,对每条 URL 再调用 `fetchViaJinaReader` 取正文

- **CSS 模式**：
  1. 用原生 `fetch`（走 `fetchWithPolicy`）拉原始 HTML
  2. 用 `cheerio` 加载 HTML
  3. 用 `items` 选择器找到所有文章卡容器
  4. 每个容器里用 `title` / `link` / `date` / `summary` 相对选择器抽字段
  5. 解析相对链接为绝对（`new URL(relative, listUrl).toString()`）
  6. 取前 N 条,可选深读

Channel 格式：`list/{hostname}`（取 listUrl 的 hostname）

### Step 1.1 — 测试 `src/lib/collection/adapters/__tests__/list-scraper.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listScraperAdapter } from "../list-scraper";

vi.mock("@/lib/web-fetch", () => ({
  fetchViaJinaReader: vi.fn(),
}));

// Mock native fetch (for CSS mode's raw HTML fetch)
const originalFetch = globalThis.fetch;

import { fetchViaJinaReader } from "@/lib/web-fetch";

describe("listScraperAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("has correct metadata + 5 config fields", () => {
    expect(listScraperAdapter.type).toBe("list_scraper");
    expect(listScraperAdapter.category).toBe("list");
    const keys = listScraperAdapter.configFields.map((f) => f.key);
    expect(keys).toContain("listUrl");
    expect(keys).toContain("extractMode");
  });

  it("validates config — requires listUrl + extractMode", () => {
    expect(listScraperAdapter.configSchema.safeParse({}).success).toBe(false);
    expect(listScraperAdapter.configSchema.safeParse({
      listUrl: "https://a.com",
    }).success).toBe(false);
    expect(listScraperAdapter.configSchema.safeParse({
      listUrl: "https://a.com",
      extractMode: "regex",
      articleUrlPattern: "/\\d+/",
    }).success).toBe(true);
  });

  it("regex mode: extracts URLs from markdown via pattern", async () => {
    vi.mocked(fetchViaJinaReader).mockResolvedValue({
      title: "列表页",
      content: `
# 政治新闻
- [习主席会见外宾](https://www.xinhuanet.com/politics/2026-04/18/c_1234.htm)
- [全国人大常委会](https://www.xinhuanet.com/politics/2026-04/18/c_5678.htm)
- [其他无关链接](https://other.com/page)
      `,
    });

    const result = await listScraperAdapter.execute({
      config: {
        listUrl: "https://www.xinhuanet.com/politics/",
        extractMode: "regex",
        articleUrlPattern: "xinhuanet\\.com/politics/\\d{4}-\\d{2}/\\d{2}/",
        maxArticlesPerRun: 10,
        fetchFullContent: false,
      },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log: vi.fn(),
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].url).toMatch(/xinhuanet\.com/);
    expect(result.items[0].title).toBe("习主席会见外宾");
    expect(result.items[0].channel).toBe("list/www.xinhuanet.com");
  });

  it("css mode: parses HTML with cheerio selectors", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <html><body>
          <div class="card">
            <h3><a href="/article/1">文章一</a></h3>
            <span class="date">2026-04-18</span>
            <p class="summary">摘要一</p>
          </div>
          <div class="card">
            <h3><a href="/article/2">文章二</a></h3>
            <span class="date">2026-04-17</span>
          </div>
        </body></html>
      `,
    }) as unknown as typeof fetch;

    const result = await listScraperAdapter.execute({
      config: {
        listUrl: "https://example.com/list",
        extractMode: "css",
        selectors: {
          items: ".card",
          title: "h3 a",
          link: "h3 a",
          date: ".date",
          summary: ".summary",
        },
        maxArticlesPerRun: 10,
        fetchFullContent: false,
      },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log: vi.fn(),
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: "文章一",
      url: "https://example.com/article/1",
      summary: "摘要一",
      channel: "list/example.com",
    });
    expect(result.items[0].publishedAt).toBeInstanceOf(Date);
  });

  it("records partialFailure when list-page fetch fails", async () => {
    vi.mocked(fetchViaJinaReader).mockRejectedValue(new Error("Jina 503"));
    const log = vi.fn();
    const result = await listScraperAdapter.execute({
      config: {
        listUrl: "https://a.com",
        extractMode: "regex",
        articleUrlPattern: "/\\d+/",
        maxArticlesPerRun: 10,
        fetchFullContent: false,
      },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log,
    });
    expect(result.items).toHaveLength(0);
    expect(result.partialFailures?.[0].message).toMatch(/Jina 503/);
  });

  it("caps results at maxArticlesPerRun", async () => {
    const manyLinks = Array.from({ length: 30 }, (_, i) =>
      `[标题${i}](https://a.com/article/${i})`,
    ).join("\n");

    vi.mocked(fetchViaJinaReader).mockResolvedValue({
      title: "",
      content: manyLinks,
    });

    const result = await listScraperAdapter.execute({
      config: {
        listUrl: "https://a.com/list",
        extractMode: "regex",
        articleUrlPattern: "a\\.com/article/\\d+",
        maxArticlesPerRun: 5,
        fetchFullContent: false,
      },
      sourceId: "s", organizationId: "o", runId: "r", log: vi.fn(),
    });

    expect(result.items).toHaveLength(5);
  });
});
```

Add to top of test file if not imported: `import { afterEach } from "vitest";`

### Step 1.2 — Implementation `src/lib/collection/adapters/list-scraper.ts`

```ts
import { z } from "zod";
import * as cheerio from "cheerio";
import type { SourceAdapter, RawItem } from "../types";
import { fetchWithPolicy, DEFAULT_FETCH_POLICY } from "../fetch-layer";
import { fetchViaJinaReader } from "@/lib/web-fetch";

const selectorsSchema = z.object({
  items: z.string().min(1),
  title: z.string().min(1),
  link: z.string().min(1),
  date: z.string().optional(),
  summary: z.string().optional(),
});

const configSchema = z
  .object({
    listUrl: z.string().url("请填写合法的列表页 URL"),
    extractMode: z.enum(["regex", "css"]),
    articleUrlPattern: z.string().optional(),
    selectors: selectorsSchema.optional(),
    maxArticlesPerRun: z.number().int().min(1).max(100).default(10),
    fetchFullContent: z.boolean().default(false),
  })
  .refine(
    (v) => v.extractMode === "regex" ? Boolean(v.articleUrlPattern) : Boolean(v.selectors),
    { message: "regex 模式需填 articleUrlPattern;css 模式需填 selectors" },
  );

type ListScraperConfig = z.infer<typeof configSchema>;

export const listScraperAdapter: SourceAdapter<ListScraperConfig> = {
  type: "list_scraper",
  displayName: "列表抓取 (正则或 CSS 选择器)",
  description: "从新闻列表页抓文章链接: regex 模式用 Jina Markdown+正则,css 模式用 cheerio CSS 选择器",
  category: "list",
  configSchema,
  configFields: [
    { key: "listUrl", label: "列表页 URL", type: "url", required: true },
    {
      key: "extractMode",
      label: "提取模式",
      type: "select",
      required: true,
      options: [
        { value: "regex", label: "正则匹配(Jina Markdown)" },
        { value: "css", label: "CSS 选择器(原始 HTML)" },
      ],
    },
    {
      key: "articleUrlPattern",
      label: "文章 URL 正则(仅正则模式)",
      type: "text",
      help: "如: xinhuanet\\.com/politics/\\d{4}-\\d{2}/\\d{2}/",
    },
    {
      key: "selectors",
      label: "CSS 选择器 JSON(仅 CSS 模式)",
      type: "kv",
      help: '例: {"items":".card","title":"h3","link":"a","date":".date","summary":"p"}',
    },
    {
      key: "maxArticlesPerRun",
      label: "每次最多抓取条数",
      type: "number",
      validation: { min: 1, max: 100 },
    },
    { key: "fetchFullContent", label: "深读正文(Jina)", type: "boolean" },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    let hostname = "unknown";
    try {
      hostname = new URL(config.listUrl).hostname;
    } catch {
      return { items, partialFailures: [{ message: "invalid listUrl" }] };
    }
    const channel = `list/${hostname}`;

    try {
      if (config.extractMode === "regex") {
        // Regex mode: Jina Reader → Markdown → pattern match
        const { content } = await fetchViaJinaReader(config.listUrl);
        const pattern = new RegExp(config.articleUrlPattern!);
        // Match markdown links: [text](url)
        const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
        const matches: { title: string; url: string }[] = [];
        let m: RegExpExecArray | null;
        while ((m = linkRegex.exec(content))) {
          if (pattern.test(m[2])) {
            matches.push({ title: m[1].trim(), url: m[2] });
          }
        }
        const capped = matches.slice(0, config.maxArticlesPerRun);

        for (const entry of capped) {
          const item: RawItem = {
            title: entry.title,
            url: entry.url,
            channel,
            rawMetadata: { source: "list-regex" },
          };
          if (config.fetchFullContent) {
            try {
              const full = await fetchViaJinaReader(entry.url);
              if (full.content && full.content.length >= 50) {
                item.content = full.content;
              }
            } catch (err) {
              log("warn", `deep-read failed for ${entry.url}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
          items.push(item);
        }
      } else {
        // CSS mode: raw HTML → cheerio
        const response = await fetchWithPolicy(
          async ({ signal }) => {
            const r = await fetch(config.listUrl, { signal, cache: "no-store" });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          },
          DEFAULT_FETCH_POLICY,
        );
        const $ = cheerio.load(response);
        const sel = config.selectors!;
        const cards = $(sel.items).slice(0, config.maxArticlesPerRun);

        cards.each((_, el) => {
          const $el = $(el);
          const title = $el.find(sel.title).first().text().trim();
          const linkRaw = $el.find(sel.link).first().attr("href");
          if (!title || !linkRaw) return;
          let url: string;
          try {
            url = new URL(linkRaw, config.listUrl).toString();
          } catch {
            return;
          }
          const dateStr = sel.date ? $el.find(sel.date).first().text().trim() : undefined;
          const summary = sel.summary ? $el.find(sel.summary).first().text().trim() : undefined;
          const publishedAt = parseFlexibleDate(dateStr);

          items.push({
            title,
            url,
            summary: summary || undefined,
            publishedAt,
            channel,
            rawMetadata: { source: "list-css" },
          });
        });

        // Optional deep-read per item (serial to avoid overwhelming target)
        if (config.fetchFullContent) {
          for (const item of items) {
            if (!item.url) continue;
            try {
              const full = await fetchViaJinaReader(item.url);
              if (full.content && full.content.length >= 50) {
                item.content = full.content;
              }
            } catch (err) {
              log("warn", `deep-read failed for ${item.url}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      partialFailures.push({ message, meta: { listUrl: config.listUrl } });
      log("error", `list_scraper failed: ${message}`, { listUrl: config.listUrl });
    }

    return { items, partialFailures };
  },
};

function parseFlexibleDate(s?: string): Date | undefined {
  if (!s) return undefined;
  // Try ISO / Date.parse first
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  // Chinese date patterns: "2026年4月18日", "2026-04-18", "04-18"
  const cn = s.match(/(\d{4})[-年.\/](\d{1,2})[-月.\/](\d{1,2})/);
  if (cn) {
    const dt = new Date(Number(cn[1]), Number(cn[2]) - 1, Number(cn[3]));
    if (!isNaN(dt.getTime())) return dt;
  }
  return undefined;
}
```

### Step 1.3 — Run tests

```bash
npm run test -- src/lib/collection/adapters/__tests__/list-scraper.test.ts
```

All 5 tests should pass.

### Step 1.4 — Commit

```bash
git add src/lib/collection/adapters/list-scraper.ts src/lib/collection/adapters/__tests__/list-scraper.test.ts
git commit -m "feat(collection-hub/phase3): add list_scraper Adapter (regex + CSS modes)"
```

---

## Task 2: `rss` Adapter — RSS/Atom 订阅

**Files:**
- Create: `src/lib/collection/adapters/rss.ts`
- Test: `src/lib/collection/adapters/__tests__/rss.test.ts`

### 设计

config 形态：

```ts
{
  feedUrl: string (url),
  fetchFullContent?: boolean (default false — 多数 RSS snippet 够用)
}
```

**逻辑：**
1. Fetch `feedUrl`（走 `fetchWithPolicy`）
2. 用 `cheerio` 的 XML 模式解析（cheerio 支持 `xmlMode: true`）
3. 尝试两种格式：
   - RSS 2.0: `<rss><channel><item>` 下有 `<title>`, `<link>`, `<pubDate>`, `<description>`
   - Atom: `<feed><entry>` 下有 `<title>`, `<link href=...>`, `<updated>`/`<published>`, `<summary>`
4. Map 到 RawItem,channel=`rss/{hostname}`
5. 可选深读

### Step 2.1 — Test

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rssAdapter } from "../rss";

const originalFetch = globalThis.fetch;

describe("rssAdapter", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("has correct metadata", () => {
    expect(rssAdapter.type).toBe("rss");
    expect(rssAdapter.category).toBe("feed");
  });

  it("rejects config without feedUrl", () => {
    expect(rssAdapter.configSchema.safeParse({}).success).toBe(false);
  });

  it("parses RSS 2.0 feed", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Example Feed</title>
  <item>
    <title>文章一</title>
    <link>https://example.com/a</link>
    <pubDate>Wed, 16 Apr 2026 10:00:00 GMT</pubDate>
    <description>摘要一</description>
  </item>
  <item>
    <title>文章二</title>
    <link>https://example.com/b</link>
    <pubDate>Wed, 17 Apr 2026 10:00:00 GMT</pubDate>
    <description>摘要二</description>
  </item>
</channel>
</rss>`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => xml,
    }) as unknown as typeof fetch;

    const result = await rssAdapter.execute({
      config: { feedUrl: "https://example.com/rss.xml", fetchFullContent: false },
      sourceId: "s", organizationId: "o", runId: "r", log: vi.fn(),
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      title: "文章一",
      url: "https://example.com/a",
      summary: "摘要一",
      channel: "rss/example.com",
    });
    expect(result.items[0].publishedAt).toBeInstanceOf(Date);
  });

  it("parses Atom feed", async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Feed</title>
  <entry>
    <title>Atom Article</title>
    <link href="https://example.com/atom/1" />
    <published>2026-04-18T10:00:00Z</published>
    <summary>An atom summary</summary>
  </entry>
</feed>`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => xml,
    }) as unknown as typeof fetch;

    const result = await rssAdapter.execute({
      config: { feedUrl: "https://example.com/atom.xml", fetchFullContent: false },
      sourceId: "s", organizationId: "o", runId: "r", log: vi.fn(),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Atom Article");
    expect(result.items[0].url).toBe("https://example.com/atom/1");
  });

  it("records partialFailure on network error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;

    const log = vi.fn();
    const result = await rssAdapter.execute({
      config: { feedUrl: "https://example.com/rss.xml", fetchFullContent: false },
      sourceId: "s", organizationId: "o", runId: "r", log,
    });
    expect(result.items).toHaveLength(0);
    expect(result.partialFailures).toHaveLength(1);
  });
});
```

### Step 2.2 — Implementation `src/lib/collection/adapters/rss.ts`

```ts
import { z } from "zod";
import * as cheerio from "cheerio";
import type { SourceAdapter, RawItem } from "../types";
import { fetchWithPolicy, DEFAULT_FETCH_POLICY } from "../fetch-layer";
import { fetchViaJinaReader } from "@/lib/web-fetch";

const configSchema = z.object({
  feedUrl: z.string().url("请填写合法的 feed URL"),
  fetchFullContent: z.boolean().default(false),
});

type RssConfig = z.infer<typeof configSchema>;

export const rssAdapter: SourceAdapter<RssConfig> = {
  type: "rss",
  displayName: "RSS / Atom 订阅",
  description: "订阅 RSS 2.0 或 Atom feed, 抓取最新条目",
  category: "feed",
  configSchema,
  configFields: [
    { key: "feedUrl", label: "Feed URL", type: "url", required: true, help: "如 https://www.huxiu.com/rss/0.xml" },
    { key: "fetchFullContent", label: "深读正文(Jina)", type: "boolean", help: "RSS 摘要通常够用;开启后会对每条链接再调一次 Jina" },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    let hostname = "unknown";
    try {
      hostname = new URL(config.feedUrl).hostname;
    } catch {
      return { items, partialFailures: [{ message: "invalid feedUrl" }] };
    }
    const channel = `rss/${hostname}`;

    try {
      const xml = await fetchWithPolicy(
        async ({ signal }) => {
          const r = await fetch(config.feedUrl, { signal, cache: "no-store" });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        },
        DEFAULT_FETCH_POLICY,
      );

      const $ = cheerio.load(xml, { xmlMode: true });

      // Try RSS 2.0 first
      const rssItems = $("rss > channel > item");
      if (rssItems.length > 0) {
        rssItems.each((_, el) => {
          const $el = $(el);
          const title = $el.children("title").first().text().trim();
          const link = $el.children("link").first().text().trim();
          const pubDate = $el.children("pubDate").first().text().trim();
          const description = $el.children("description").first().text().trim();
          if (!title || !link) return;
          items.push({
            title,
            url: link,
            summary: description || undefined,
            publishedAt: pubDate ? safeParseDate(pubDate) : undefined,
            channel,
            rawMetadata: { format: "rss2" },
          });
        });
      } else {
        // Try Atom
        const atomEntries = $("feed > entry");
        atomEntries.each((_, el) => {
          const $el = $(el);
          const title = $el.children("title").first().text().trim();
          // Atom: <link href="..." />
          const linkHref = $el.children("link").first().attr("href");
          const published = $el.children("published").first().text().trim()
            || $el.children("updated").first().text().trim();
          const summary = $el.children("summary").first().text().trim()
            || $el.children("content").first().text().trim();
          if (!title || !linkHref) return;
          items.push({
            title,
            url: linkHref,
            summary: summary || undefined,
            publishedAt: published ? safeParseDate(published) : undefined,
            channel,
            rawMetadata: { format: "atom" },
          });
        });
      }

      // Optional deep-read
      if (config.fetchFullContent && items.length > 0) {
        for (const item of items) {
          if (!item.url) continue;
          try {
            const full = await fetchViaJinaReader(item.url);
            if (full.content && full.content.length >= 50) {
              item.content = full.content;
            }
          } catch (err) {
            log("warn", `deep-read failed for ${item.url}`, {
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      partialFailures.push({ message, meta: { feedUrl: config.feedUrl } });
      log("error", `rss fetch failed: ${message}`, { feedUrl: config.feedUrl });
    }

    return { items, partialFailures };
  },
};

function safeParseDate(s: string): Date | undefined {
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}
```

### Step 2.3 — Run tests

```bash
npm run test -- src/lib/collection/adapters/__tests__/rss.test.ts
```

All 4 tests should pass.

### Step 2.4 — Commit

```bash
git add src/lib/collection/adapters/rss.ts src/lib/collection/adapters/__tests__/rss.test.ts
git commit -m "feat(collection-hub/phase3): add rss Adapter (RSS 2.0 + Atom via cheerio xmlMode)"
```

---

## Task 3: Register + Phase 3 acceptance

**Files:**
- Modify: `src/lib/collection/adapters/index.ts`

### Step 3.1 — Register both

Update `src/lib/collection/adapters/index.ts`:

```ts
import { registerAdapter } from "../registry";
import { tophubAdapter } from "./tophub";
import { tavilyAdapter } from "./tavily";
import { jinaUrlAdapter } from "./jina-url";
import { listScraperAdapter } from "./list-scraper";
import { rssAdapter } from "./rss";

// Phase 0: 3 个基础 Adapter
registerAdapter(tophubAdapter);
registerAdapter(tavilyAdapter);
registerAdapter(jinaUrlAdapter);
// Phase 3: 2 个新增 Adapter
registerAdapter(listScraperAdapter);
registerAdapter(rssAdapter);

export {
  tophubAdapter,
  tavilyAdapter,
  jinaUrlAdapter,
  listScraperAdapter,
  rssAdapter,
};
```

### Step 3.2 — Full acceptance

```bash
npm run test       # expect all tests pass; new list_scraper + rss contribute ~9 tests
npx tsc --noEmit   # clean
npm run build      # clean
```

### Step 3.3 — Update spec

In `docs/superpowers/specs/2026-04-18-unified-collection-module-design.md`, find Phase 3 heading and mark partial completion: `✅ Adapter 部分完成 2026-04-18 (研究任务迁移留给 Phase 4)`.

### Step 3.4 — Commit

```bash
git add src/lib/collection/adapters/index.ts docs/superpowers/specs/2026-04-18-unified-collection-module-design.md
git commit -m "$(cat <<'EOF'
feat(collection-hub/phase3): register list_scraper + rss adapters

Phase 3 scope reduced to adapter additions only. Research task migration
and benchmarking migration deferred to Phase 4 (they produce more value
when bundled with content browser UI, which itself is a Phase 4 deliverable).

Operators can now self-serve add:
- Any RSS/Atom feed as a source
- Any site with regex-extractable article URL pattern (e.g. Xinhua, People's Daily)
- Any site with stable CSS selectors for article cards

Verification:
- 9+ new adapter tests pass (5 list_scraper + 4 rss)
- tsc --noEmit + npm run build clean
- /data-collection/sources/new wizard automatically picks up both from Registry
EOF
)"
```

---

## Phase 3 后手工验收（可选,代理修好后）

1. 打开 `/data-collection/sources/new`,应看到 5 张类型卡（TopHub / Tavily / Jina URL / 列表抓取 / RSS）
2. 用 RSS 建一个源：
   - feedUrl: `https://www.huxiu.com/rss/0.xml`
   - targetModules: `["hot_topics"]`（让它也进 hot_topics）
   - 手工触发 → 看 20 秒后详情页"最近内容"tab,应有虎嗅最新文章
3. 用 list_scraper (regex 模式) 建一个源:
   - listUrl: `https://www.xinhuanet.com/politics/`
   - extractMode: `regex`
   - articleUrlPattern: `xinhuanet\.com/politics/\d{4}-\d{2}/\d{2}/`
   - maxArticlesPerRun: 10
   - 手工触发 → 应抓到当日政治新闻列表

---

## Phase 4 预告

Phase 4 范围：
- 研究任务 3 分支迁移（Tavily/whitelist→list_scraper/manual→jina_url）
- benchmarking 迁移（per-platform scheduler 抽象化）
- 内容浏览页 `/data-collection/content`（卡片+表格双视图 + trigram 全文搜索 + 筛选抽屉）
- 监控面板 `/data-collection/monitoring`
- 预估 2-2.5 周（最大的 phase,含大量 UI）

等 Phase 3 手工验收通过 + 一周生产观察后启动。
