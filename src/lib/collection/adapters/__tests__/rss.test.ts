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
