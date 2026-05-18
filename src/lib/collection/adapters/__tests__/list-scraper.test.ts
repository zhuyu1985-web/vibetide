import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

  it("regex mode: handles nested markdown (image inside link text, e.g. cbg.cn)", async () => {
    // cbg.cn 列表页里每条文章的 markdown 形如:
    //   [标题![Image N](图片URL) 摘要 时间](文章URL "title")
    // 旧的 `\[([^\]]+)\]\(url\)` 正则会被内层的 `[Image N]` 截断,
    // 命中图片链接而不是文章链接,导致整页 0 条。
    vi.mocked(fetchViaJinaReader).mockResolvedValue({
      title: "重庆新闻",
      content: `
*   [重点工程提速攻坚![Image 1](https://cmsimg.cbg.cn/2026/05/14/dd8dc760.png) 重点工程提速攻坚 来源：视界网 2026-05-14 11:34](https://www.cbg.cn/a/705/20260514/7f54fb3d3c264d20accf79f6447a2be5.html "重点工程提速攻坚")
*   [数字赋能提升治理能力![Image 2](https://cmsimg.cbg.cn/2026/05/14/7dbd2a73.png) 数字赋能 2026-05-14 11:34](https://www.cbg.cn/a/705/20260514/4870dcd0fe7442eb931139433dd8ffb6.html "数字赋能")
      `,
    });

    const result = await listScraperAdapter.execute({
      config: {
        listUrl: "https://www.cbg.cn/list/705/1.html",
        extractMode: "regex",
        articleUrlPattern: "cbg\\.cn/a/\\d+/\\d{8}/[a-f0-9]+\\.html",
        maxArticlesPerRun: 10,
        fetchFullContent: false,
      },
      sourceId: "s", organizationId: "o", runId: "r", log: vi.fn(),
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0].url).toBe(
      "https://www.cbg.cn/a/705/20260514/7f54fb3d3c264d20accf79f6447a2be5.html",
    );
    expect(result.items[1].url).toBe(
      "https://www.cbg.cn/a/705/20260514/4870dcd0fe7442eb931139433dd8ffb6.html",
    );
    // Title 至少包含人类可读的文字片段(不是裸 URL),且不含 markdown 图片语法
    expect(result.items[0].title).toContain("重点工程提速攻坚");
    expect(result.items[0].title).not.toMatch(/!\[/);
  });

  it("regex mode (smart fallback): when articleUrlPattern is empty, heuristically picks candidate article URLs", async () => {
    // 用户在 wizard 留空"文章 URL 正则"→ 走智能模式:
    //   - 同 host
    //   - 排除资源(.jpg/.png/.css/...)
    //   - 排除明显的导航/栏目入口(`/list/`, `/category/`, `/tag/`, `/`, `/about` 等)
    //   - 路径深度 ≥ 2(过滤掉只到栏目层级的 URL)
    vi.mocked(fetchViaJinaReader).mockResolvedValue({
      title: "重庆新闻",
      content: `
# 重庆新闻

*   [首页](https://www.cbg.cn/)
*   [栏目入口](https://www.cbg.cn/list/705/1.html)
*   [分类](https://www.cbg.cn/category/5039/1.html)
*   [图片](https://cmsimg.cbg.cn/2026/05/14/xxx.jpg)
*   [文章一](https://www.cbg.cn/a/705/20260514/abc123def456.html)
*   [文章二](https://www.cbg.cn/a/705/20260514/789def012abc.html)
*   [外站](https://other.com/article/1)
*   [About](https://www.cbg.cn/about)
*   [文章三](https://www.cbg.cn/news/20260514/xyz.html)
      `,
    });

    const result = await listScraperAdapter.execute({
      config: {
        listUrl: "https://www.cbg.cn/list/705/1.html",
        extractMode: "regex",
        // articleUrlPattern 故意留空 → 智能模式
        maxArticlesPerRun: 50,
        fetchFullContent: false,
      },
      sourceId: "s", organizationId: "o", runId: "r", log: vi.fn(),
    });

    const urls = result.items.map((it) => it.url);
    // 应该命中:文章一/二/三
    expect(urls).toContain("https://www.cbg.cn/a/705/20260514/abc123def456.html");
    expect(urls).toContain("https://www.cbg.cn/a/705/20260514/789def012abc.html");
    expect(urls).toContain("https://www.cbg.cn/news/20260514/xyz.html");
    // 不应包含:外站 / 图片资源 / 栏目入口 / 首页 / about
    expect(urls).not.toContain("https://other.com/article/1");
    expect(urls?.some((u) => u?.endsWith(".jpg"))).toBe(false);
    expect(urls).not.toContain("https://www.cbg.cn/list/705/1.html");
    expect(urls).not.toContain("https://www.cbg.cn/category/5039/1.html");
    expect(urls).not.toContain("https://www.cbg.cn/");
    expect(urls).not.toContain("https://www.cbg.cn/about");
  });

  it("regex mode: overrides title with Jina full-fetch title when fetchFullContent=true", async () => {
    vi.mocked(fetchViaJinaReader)
      .mockResolvedValueOnce({
        title: "列表页",
        content: `[原始链接文本](https://a.com/article/123)`,
      })
      .mockResolvedValueOnce({
        title: "干净的文章标题",
        content: "x".repeat(100),
      });

    const result = await listScraperAdapter.execute({
      config: {
        listUrl: "https://a.com/list",
        extractMode: "regex",
        articleUrlPattern: "a\\.com/article/\\d+",
        maxArticlesPerRun: 10,
        fetchFullContent: true,
      },
      sourceId: "s", organizationId: "o", runId: "r", log: vi.fn(),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("干净的文章标题");
    expect(result.items[0].content).toHaveLength(100);
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
