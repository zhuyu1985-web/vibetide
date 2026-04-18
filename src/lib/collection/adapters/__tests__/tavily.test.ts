import { describe, it, expect, vi, beforeEach } from "vitest";
import { tavilyAdapter } from "../tavily";

vi.mock("@/lib/web-fetch", () => ({
  searchViaTavily: vi.fn(),
}));

import { searchViaTavily } from "@/lib/web-fetch";

describe("tavilyAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has correct metadata", () => {
    expect(tavilyAdapter.type).toBe("tavily");
    expect(tavilyAdapter.category).toBe("search");
    expect(tavilyAdapter.configFields.find((f) => f.key === "keywords")).toBeTruthy();
  });

  it("rejects empty keywords", () => {
    expect(tavilyAdapter.configSchema.safeParse({ keywords: [] }).success).toBe(false);
    expect(tavilyAdapter.configSchema.safeParse({}).success).toBe(false);
  });

  it("accepts minimal valid config", () => {
    const r = tavilyAdapter.configSchema.safeParse({ keywords: ["ai"] });
    expect(r.success).toBe(true);
  });

  it("normalizes NewsFeedItem to RawItem with channel=tavily", async () => {
    vi.mocked(searchViaTavily).mockResolvedValue({
      items: [
        {
          title: "A 国 AI 新政策",
          snippet: "据悉...",
          url: "https://example.com/a",
          source: "example.com",
          publishedAt: "2026-04-10T08:00:00Z",
          publishedAtMs: 1776124800000,
          engine: "google-news",
          sourceType: "news",
          credibility: "high",
        },
      ],
      responseTime: 123,
    });

    const result = await tavilyAdapter.execute({
      config: { keywords: ["AI 政策"], timeRange: "7d", maxResults: 8 },
      sourceId: "src-1",
      organizationId: "org-1",
      runId: "run-1",
      log: vi.fn(),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "A 国 AI 新政策",
      url: "https://example.com/a",
      summary: "据悉...",
      channel: "tavily",
    });
    expect(result.items[0].publishedAt).toBeInstanceOf(Date);
    expect(result.items[0].rawMetadata).toMatchObject({
      keyword: "AI 政策",
      source: "example.com",
      credibility: "high",
    });
  });

  it("passes includeDomains as include_domains (snake_case) to searchViaTavily", async () => {
    vi.mocked(searchViaTavily).mockResolvedValue({ items: [], responseTime: 10 });
    await tavilyAdapter.execute({
      config: {
        keywords: ["x"],
        timeRange: "24h",
        includeDomains: ["xinhuanet.com"],
        maxResults: 5,
      },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log: vi.fn(),
    });
    expect(searchViaTavily).toHaveBeenCalledWith("x", expect.objectContaining({
      timeRange: "24h",
      include_domains: ["xinhuanet.com"],
      maxResults: 5,
    }));
  });

  it("records partialFailures on per-keyword errors", async () => {
    vi.mocked(searchViaTavily)
      .mockResolvedValueOnce({ items: [], responseTime: 10 })
      .mockRejectedValueOnce(new Error("Tavily 429"));

    const log = vi.fn();
    const result = await tavilyAdapter.execute({
      config: { keywords: ["ok", "bad"], timeRange: "7d", maxResults: 8 },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log,
    });
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures?.[0].message).toMatch(/Tavily 429/);
    expect(result.partialFailures?.[0].meta).toMatchObject({ keyword: "bad" });
    expect(log).toHaveBeenCalledWith("error", expect.stringContaining("bad"), expect.anything());
  });
});
