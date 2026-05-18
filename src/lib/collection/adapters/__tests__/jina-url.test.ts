import { describe, it, expect, vi, beforeEach } from "vitest";
import { jinaUrlAdapter } from "../jina-url";

vi.mock("@/lib/web-fetch", () => ({
  fetchViaJinaReader: vi.fn(),
}));

import { fetchViaJinaReader } from "@/lib/web-fetch";

describe("jinaUrlAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has correct metadata + multi-URL textarea field", () => {
    expect(jinaUrlAdapter.type).toBe("jina_url");
    expect(jinaUrlAdapter.displayName).toBe("URL 采集");
    expect(jinaUrlAdapter.category).toBe("url");
    const urlField = jinaUrlAdapter.configFields.find((f) => f.key === "urls");
    expect(urlField?.type).toBe("textarea");
    expect(urlField?.pickFromOutletWebsite).toBe(true);
  });

  describe("configSchema", () => {
    it("rejects empty input", () => {
      expect(jinaUrlAdapter.configSchema.safeParse({}).success).toBe(false);
      expect(jinaUrlAdapter.configSchema.safeParse({ urls: [] }).success).toBe(false);
      expect(jinaUrlAdapter.configSchema.safeParse({ urls: "" }).success).toBe(false);
    });

    it("rejects URLs that fail validation", () => {
      expect(
        jinaUrlAdapter.configSchema.safeParse({ urls: ["not a url"] }).success,
      ).toBe(false);
    });

    it("accepts array of valid URLs", () => {
      const parsed = jinaUrlAdapter.configSchema.parse({
        urls: ["https://a.com/x", "https://b.com/y"],
      });
      expect(parsed).toEqual({ urls: ["https://a.com/x", "https://b.com/y"] });
    });

    it("splits newline / comma / semicolon separated string into urls[]", () => {
      const parsed = jinaUrlAdapter.configSchema.parse({
        urls: "  https://a.com/x \n https://b.com/y , https://c.com/z ; https://d.com/w  ",
      });
      expect(parsed).toEqual({
        urls: ["https://a.com/x", "https://b.com/y", "https://c.com/z", "https://d.com/w"],
      });
    });

    it("backwards-compatible: old { url: '...' } config still parses to { urls: [...] }", () => {
      const parsed = jinaUrlAdapter.configSchema.parse({ url: "https://old.com/x" });
      expect(parsed).toEqual({ urls: ["https://old.com/x"] });
    });
  });

  it("produces one RawItem per URL with channel=jina/{hostname}", async () => {
    vi.mocked(fetchViaJinaReader).mockResolvedValue({
      title: "文章标题",
      content: "这是一段很长很长的正文内容，超过 50 个字符才能通过长度校验。".repeat(3),
    });

    const result = await jinaUrlAdapter.execute({
      config: { urls: ["https://example.com/article/1", "https://other.com/article/2"] },
      sourceId: "s-1",
      organizationId: "o-1",
      runId: "r-1",
      log: vi.fn(),
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      url: "https://example.com/article/1",
      channel: "jina/example.com",
    });
    expect(result.items[1]).toMatchObject({
      url: "https://other.com/article/2",
      channel: "jina/other.com",
    });
  });

  it("records partialFailure when content is too short, continues with rest", async () => {
    vi.mocked(fetchViaJinaReader)
      .mockResolvedValueOnce({ title: "", content: "too short" })
      .mockResolvedValueOnce({
        title: "ok",
        content: "正文够长".repeat(20),
      });
    const log = vi.fn();
    const result = await jinaUrlAdapter.execute({
      config: { urls: ["https://example.com/short", "https://example.com/ok"] },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].url).toBe("https://example.com/ok");
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures?.[0].message).toMatch(/too short/i);
  });

  it("records partialFailure when Jina throws, continues with rest", async () => {
    vi.mocked(fetchViaJinaReader)
      .mockRejectedValueOnce(new Error("Jina 503"))
      .mockResolvedValueOnce({
        title: "ok",
        content: "正文够长".repeat(20),
      });
    const log = vi.fn();
    const result = await jinaUrlAdapter.execute({
      config: { urls: ["https://example.com/x", "https://example.com/y"] },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log,
    });
    expect(result.items).toHaveLength(1);
    expect(result.partialFailures?.[0].message).toMatch(/Jina 503/);
    expect(log).toHaveBeenCalledWith("error", expect.stringContaining("Jina"), expect.anything());
  });
});
