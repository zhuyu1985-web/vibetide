import { describe, it, expect, vi, beforeEach } from "vitest";
import { tophubAdapter } from "../tophub";

vi.mock("@/lib/trending-api", () => ({
  fetchTrendingFromApi: vi.fn(),
}));

import { fetchTrendingFromApi } from "@/lib/trending-api";

describe("tophubAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct metadata", () => {
    expect(tophubAdapter.type).toBe("tophub");
    expect(tophubAdapter.category).toBe("aggregator");
    expect(tophubAdapter.configFields.find((f) => f.key === "platforms")).toBeTruthy();
  });

  it("validates config with zod — rejects missing platforms", () => {
    const result = tophubAdapter.configSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates config with zod — accepts valid shape", () => {
    const result = tophubAdapter.configSchema.safeParse({ platforms: ["weibo", "zhihu"] });
    expect(result.success).toBe(true);
  });

  it("execute fetches items and normalizes to RawItem with channel", async () => {
    vi.mocked(fetchTrendingFromApi).mockResolvedValue([
      { platform: "微博热搜", rank: 1, title: "微博热点 A", heat: 100000, url: "https://weibo.com/a" },
      { platform: "微博热搜", rank: 2, title: "微博热点 B", heat: 90000, url: "https://weibo.com/b" },
      { platform: "知乎热榜", rank: 1, title: "知乎热点 X", heat: 50000, url: "https://zhihu.com/x", category: "科技" },
    ]);

    const result = await tophubAdapter.execute({
      config: { platforms: ["weibo", "zhihu"] },
      sourceId: "src-1",
      organizationId: "org-1",
      runId: "run-1",
      log: vi.fn(),
    });

    expect(result.items).toHaveLength(3);
    expect(result.items[0].title).toBe("微博热点 A");
    expect(result.items[0].url).toBe("https://weibo.com/a");
    expect(result.items[0].channel).toBe("tophub/微博热搜");
    expect(result.items[0].rawMetadata).toMatchObject({ rank: 1, heat: 100000 });
    expect(result.items[2].channel).toBe("tophub/知乎热榜");
    expect(result.items[2].rawMetadata).toMatchObject({ category: "科技" });
    expect(fetchTrendingFromApi).toHaveBeenCalledWith("platforms", { platforms: ["weibo", "zhihu"] });
  });

  it("execute surfaces error when fetchTrendingFromApi throws", async () => {
    vi.mocked(fetchTrendingFromApi).mockRejectedValue(new Error("Tophub 503"));

    const log = vi.fn();
    const result = await tophubAdapter.execute({
      config: { platforms: ["weibo"] },
      sourceId: "src-1",
      organizationId: "org-1",
      runId: "run-1",
      log,
    });

    expect(result.items).toHaveLength(0);
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures?.[0].message).toMatch(/Tophub 503/);
    expect(log).toHaveBeenCalledWith("error", expect.stringMatching(/tophub/i), expect.anything());
  });
});
