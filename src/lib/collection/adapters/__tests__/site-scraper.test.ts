import { describe, it, expect, vi, beforeEach } from "vitest";
import { siteScraperAdapter } from "../site-scraper";

vi.mock("@/lib/web-fetch", () => ({
  fetchViaJinaReader: vi.fn(),
}));
vi.mock("../site-scraper-discovery", () => ({
  fetchSitemapUrls: vi.fn(),
  pickColumnUrlsFromSitemap: vi.fn(),
  discoverColumnsByLlm: vi.fn(),
}));

import { fetchViaJinaReader } from "@/lib/web-fetch";
import {
  fetchSitemapUrls,
  pickColumnUrlsFromSitemap,
  discoverColumnsByLlm,
} from "../site-scraper-discovery";

const baseConfig = {
  siteUrl: "https://example.com",
  columnUrls: [],
  maxColumns: 10,
  maxArticlesPerColumn: 5,
  columnBlockPatterns: [],
  fetchFullContent: true,
  skipEmptyContent: false,
  enableLlmFallback: false, // baseConfig 仍用 false 测纯 sitemap 路径
};

const ctx = {
  sourceId: "s",
  organizationId: "o",
  runId: "r",
  log: vi.fn(),
};

describe("siteScraperAdapter", () => {
  beforeEach(() => {
    // resetAllMocks 清掉 mockResolvedValueOnce 的 queue,避免测试间相互污染
    vi.resetAllMocks();
  });

  describe("元数据与 schema", () => {
    it("metadata + 8 配置字段", () => {
      expect(siteScraperAdapter.type).toBe("site_scraper");
      expect(siteScraperAdapter.category).toBe("list");
      const keys = siteScraperAdapter.configFields.map((f) => f.key);
      expect(keys).toEqual([
        "siteUrl",
        "columnUrls",
        "maxColumns",
        "maxArticlesPerColumn",
        "columnBlockPatterns",
        "fetchFullContent",
        "skipEmptyContent",
        "enableLlmFallback",
      ]);
    });

    it("schema 默认值", () => {
      const parsed = siteScraperAdapter.configSchema.parse({
        siteUrl: "https://x.com",
      }) as {
        columnUrls: string[];
        maxColumns: number;
        maxArticlesPerColumn: number;
        columnBlockPatterns: string[];
        fetchFullContent: boolean;
        skipEmptyContent: boolean;
        enableLlmFallback: boolean;
      };
      expect(parsed.columnUrls).toEqual([]);
      expect(parsed.maxColumns).toBe(50);
      expect(parsed.maxArticlesPerColumn).toBe(24);
      expect(parsed.fetchFullContent).toBe(true);
      expect(parsed.skipEmptyContent).toBe(true);
      expect(parsed.enableLlmFallback).toBe(true);
    });

    it("columnUrls 支持 textarea 字符串(换行 / 逗号 / 分号)", () => {
      const parsed = siteScraperAdapter.configSchema.parse({
        siteUrl: "https://x.com",
        columnUrls: "https://x.com/a\nhttps://x.com/b, https://x.com/c",
      }) as { columnUrls: string[] };
      expect(parsed.columnUrls).toEqual([
        "https://x.com/a",
        "https://x.com/b",
        "https://x.com/c",
      ]);
    });
  });

  describe("Layer 1: 用户手填 columnUrls", () => {
    it("有 columnUrls 时跳过 sitemap / LLM,直接用", async () => {
      vi.mocked(fetchViaJinaReader)
        .mockResolvedValueOnce({
          title: "Column A",
          content: `[文章 A1](https://example.com/a/1.html)`,
        })
        .mockResolvedValueOnce({ title: "A1", content: "x".repeat(200) });

      const result = await siteScraperAdapter.execute({
        config: { ...baseConfig, columnUrls: ["https://example.com/a/"] },
        ...ctx,
      });

      expect(fetchSitemapUrls).not.toHaveBeenCalled();
      expect(discoverColumnsByLlm).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    }, 10_000);
  });

  describe("Layer 2: Sitemap.xml 自动发现", () => {
    it("没填 columnUrls 时调 sitemap,把发现的栏目当入口跑", async () => {
      vi.mocked(fetchSitemapUrls).mockResolvedValueOnce([
        "https://example.com/news/",
        "https://example.com/sports/",
        "https://example.com/news/2026/01/article.html",
      ]);
      vi.mocked(pickColumnUrlsFromSitemap).mockReturnValueOnce([
        "https://example.com/news/",
        "https://example.com/sports/",
      ]);
      // 栏目 1 列表 + 文章
      vi.mocked(fetchViaJinaReader)
        .mockResolvedValueOnce({
          title: "News",
          content: `[文章 N1](https://example.com/n/1.html)`,
        })
        .mockResolvedValueOnce({ title: "N1", content: "x".repeat(200) })
        // 栏目 2 列表 + 文章
        .mockResolvedValueOnce({
          title: "Sports",
          content: `[文章 S1](https://example.com/s/1.html)`,
        })
        .mockResolvedValueOnce({ title: "S1", content: "y".repeat(200) });

      const result = await siteScraperAdapter.execute({
        config: baseConfig,
        ...ctx,
      });

      expect(fetchSitemapUrls).toHaveBeenCalledWith("https://example.com");
      expect(pickColumnUrlsFromSitemap).toHaveBeenCalled();
      expect(discoverColumnsByLlm).not.toHaveBeenCalled();
      expect(result.items).toHaveLength(2);
    }, 10_000);

    it("Sitemap 返回空 + LLM 未启用 → 报 partialFailure 不入库", async () => {
      vi.mocked(fetchSitemapUrls).mockResolvedValueOnce([]);
      vi.mocked(pickColumnUrlsFromSitemap).mockReturnValueOnce([]);

      const result = await siteScraperAdapter.execute({
        config: baseConfig,
        ...ctx,
      });

      expect(result.items).toHaveLength(0);
      expect(result.partialFailures?.[0].message).toMatch(/未发现栏目/);
      expect(discoverColumnsByLlm).not.toHaveBeenCalled();
    });
  });

  describe("Layer 3: LLM 兜底", () => {
    it("Sitemap 失败 + enableLlmFallback=true → 调 LLM", async () => {
      vi.mocked(fetchSitemapUrls).mockResolvedValueOnce([]);
      vi.mocked(pickColumnUrlsFromSitemap).mockReturnValueOnce([]);
      // LLM 抓首页 markdown,然后返回栏目
      vi.mocked(fetchViaJinaReader)
        .mockResolvedValueOnce({
          title: "Home",
          content: "x".repeat(500),
        }) // 首页(给 LLM 用)
        .mockResolvedValueOnce({
          title: "Column A",
          content: `[文章 A1](https://example.com/a/1.html)`,
        })
        .mockResolvedValueOnce({ title: "A1", content: "x".repeat(200) });
      vi.mocked(discoverColumnsByLlm).mockResolvedValueOnce([
        "https://example.com/llm-col/",
      ]);

      const result = await siteScraperAdapter.execute({
        config: { ...baseConfig, enableLlmFallback: true },
        ...ctx,
      });

      expect(discoverColumnsByLlm).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    }, 10_000);

    it("LLM 也返回空 → 报 partialFailure", async () => {
      vi.mocked(fetchSitemapUrls).mockResolvedValueOnce([]);
      vi.mocked(pickColumnUrlsFromSitemap).mockReturnValueOnce([]);
      vi.mocked(fetchViaJinaReader).mockResolvedValueOnce({
        title: "Home",
        content: "x".repeat(500),
      });
      vi.mocked(discoverColumnsByLlm).mockResolvedValueOnce([]);

      const result = await siteScraperAdapter.execute({
        config: { ...baseConfig, enableLlmFallback: true },
        ...ctx,
      });

      expect(result.items).toHaveLength(0);
      expect(result.partialFailures?.[0].message).toMatch(/未发现栏目/);
    });
  });

  describe("行为开关", () => {
    it("columnBlockPatterns 排除栏目", async () => {
      vi.mocked(fetchSitemapUrls).mockResolvedValueOnce(["dummy"]);
      vi.mocked(pickColumnUrlsFromSitemap).mockReturnValueOnce([
        "https://example.com/keep/",
        "https://example.com/banned/",
      ]);
      vi.mocked(fetchViaJinaReader)
        .mockResolvedValueOnce({
          title: "Keep",
          content: `[文章 K1](https://example.com/k/1.html)`,
        })
        .mockResolvedValueOnce({ title: "K1", content: "x".repeat(200) });

      const result = await siteScraperAdapter.execute({
        config: { ...baseConfig, columnBlockPatterns: ["banned"] },
        ...ctx,
      });

      // 只跑了 keep 栏目,banned 被过滤
      expect(result.items).toHaveLength(1);
      // 应该只调用了 2 次 Jina:1 列表 + 1 文章(banned 没跑)
      expect(vi.mocked(fetchViaJinaReader)).toHaveBeenCalledTimes(2);
    }, 10_000);

    it("maxColumns 上限", async () => {
      vi.mocked(fetchSitemapUrls).mockResolvedValueOnce(["dummy"]);
      vi.mocked(pickColumnUrlsFromSitemap).mockReturnValueOnce([
        "https://example.com/c1/",
        "https://example.com/c2/",
        "https://example.com/c3/",
      ]);
      vi.mocked(fetchViaJinaReader)
        .mockResolvedValueOnce({
          title: "C1",
          content: `[文章](https://example.com/c1/a.html)`,
        })
        .mockResolvedValueOnce({ title: "A", content: "x".repeat(200) });

      const result = await siteScraperAdapter.execute({
        config: { ...baseConfig, maxColumns: 1 },
        ...ctx,
      });

      // 只跑第 1 个栏目 → 1 篇文章 = 1 item
      expect(result.items).toHaveLength(1);
    }, 10_000);

    it("skipEmptyContent=true 时跳过失败 / 短正文条目", async () => {
      vi.mocked(fetchSitemapUrls).mockResolvedValueOnce(["dummy"]);
      vi.mocked(pickColumnUrlsFromSitemap).mockReturnValueOnce([
        "https://example.com/col/",
      ]);
      vi.mocked(fetchViaJinaReader)
        .mockResolvedValueOnce({
          title: "Col",
          content: `
[文章 A](https://example.com/news/a.html)
[文章 B](https://example.com/news/b.html)
[文章 C](https://example.com/news/c.html)
          `,
        })
        .mockResolvedValueOnce({ title: "A 标题", content: "x".repeat(300) }) // 正文 ≥ 250 OK
        .mockResolvedValueOnce({ title: "B 标题", content: "短" }) // 短 → 跳过
        .mockRejectedValueOnce(new Error("Jina timeout")); // 失败 → 跳过

      const result = await siteScraperAdapter.execute({
        config: { ...baseConfig, skipEmptyContent: true },
        ...ctx,
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.title).toBe("A 标题");
    }, 10_000);
  });
});
