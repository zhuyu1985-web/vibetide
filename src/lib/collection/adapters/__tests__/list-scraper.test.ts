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
