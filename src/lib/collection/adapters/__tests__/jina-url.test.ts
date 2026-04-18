import { describe, it, expect, vi, beforeEach } from "vitest";
import { jinaUrlAdapter } from "../jina-url";

vi.mock("@/lib/web-fetch", () => ({
  fetchViaJinaReader: vi.fn(),
}));

import { fetchViaJinaReader } from "@/lib/web-fetch";

describe("jinaUrlAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has correct metadata", () => {
    expect(jinaUrlAdapter.type).toBe("jina_url");
    expect(jinaUrlAdapter.category).toBe("url");
    expect(jinaUrlAdapter.configFields.find((f) => f.key === "url")).toBeTruthy();
  });

  it("rejects missing or invalid URL in config", () => {
    expect(jinaUrlAdapter.configSchema.safeParse({}).success).toBe(false);
    expect(jinaUrlAdapter.configSchema.safeParse({ url: "not a url" }).success).toBe(false);
    expect(jinaUrlAdapter.configSchema.safeParse({ url: "" }).success).toBe(false);
  });

  it("accepts valid https url", () => {
    expect(jinaUrlAdapter.configSchema.safeParse({ url: "https://a.com/x" }).success).toBe(true);
  });

  it("produces one RawItem on success with channel=jina/{hostname}", async () => {
    vi.mocked(fetchViaJinaReader).mockResolvedValue({
      title: "文章标题",
      content: "这是一段很长很长的正文内容，超过 50 个字符才能通过长度校验。".repeat(3),
    });

    const result = await jinaUrlAdapter.execute({
      config: { url: "https://example.com/article/123" },
      sourceId: "s-1",
      organizationId: "o-1",
      runId: "r-1",
      log: vi.fn(),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "文章标题",
      url: "https://example.com/article/123",
      channel: "jina/example.com",
    });
    expect(result.items[0].content?.length).toBeGreaterThanOrEqual(50);
  });

  it("records partialFailure when content is too short", async () => {
    vi.mocked(fetchViaJinaReader).mockResolvedValue({
      title: "",
      content: "too short",
    });
    const log = vi.fn();
    const result = await jinaUrlAdapter.execute({
      config: { url: "https://example.com/short" },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log,
    });
    expect(result.items).toHaveLength(0);
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures?.[0].message).toMatch(/too short/i);
  });

  it("records partialFailure when Jina throws", async () => {
    vi.mocked(fetchViaJinaReader).mockRejectedValue(new Error("Jina 503"));
    const log = vi.fn();
    const result = await jinaUrlAdapter.execute({
      config: { url: "https://example.com/x" },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log,
    });
    expect(result.items).toHaveLength(0);
    expect(result.partialFailures?.[0].message).toMatch(/Jina 503/);
    expect(log).toHaveBeenCalledWith("error", expect.stringContaining("Jina"), expect.anything());
  });
});
