import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTrendingFromApi } from "../trending-api";

describe("fetchTrendingFromApi", () => {
  const originalApiKey = process.env.TRENDING_API_KEY;
  const originalTimeout = process.env.TRENDING_API_TIMEOUT_MS;

  beforeEach(() => {
    process.env.TRENDING_API_KEY = "test-key";
    delete process.env.TRENDING_API_TIMEOUT_MS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalApiKey === undefined) delete process.env.TRENDING_API_KEY;
    else process.env.TRENDING_API_KEY = originalApiKey;
    if (originalTimeout === undefined) delete process.env.TRENDING_API_TIMEOUT_MS;
    else process.env.TRENDING_API_TIMEOUT_MS = originalTimeout;
  });

  it("search 模式遇到一次超时/abort 后会重试一次", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new DOMException("The operation was aborted", "AbortError"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: false,
          data: {
            items: [
              {
                title: "成都热点",
                url: "https://example.com/chengdu",
                extra: "100w",
                time: 1,
              },
            ],
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTrendingFromApi("search", {
      query: "成都",
      limit: 20,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      {
        platform: "全网",
        rank: 1,
        title: "成都热点",
        heat: "100w",
        url: "https://example.com/chengdu",
      },
    ]);
  });

  it("search 端点两次都失败后降级到 /hot 并按城市关键词过滤", async () => {
    const fetchMock = vi
      .fn()
      // /search 两次都 abort（TopHub /search 端点不可用）
      .mockRejectedValueOnce(new DOMException("aborted", "AbortError"))
      .mockRejectedValueOnce(new DOMException("aborted", "AbortError"))
      // /hot 兜底成功，返回全网热榜（含非成都条目）
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          error: false,
          data: [
            { title: "成都地铁新线开通", url: "u1", sitename: "微博", views: "50w" },
            { title: "全国天气大降温", url: "u2", sitename: "百度", views: "30w" },
            { title: "成都美食节启动", url: "u3", sitename: "抖音", views: "20w" },
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTrendingFromApi("search", { query: "成都", limit: 20 });

    // 两次 /search + 一次 /hot = 3 次
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain("/hot");
    // 只保留标题含「成都」的条目，rank 重排为 1..N
    expect(result).toEqual([
      { platform: "微博", rank: 1, title: "成都地铁新线开通", heat: "50w", url: "u1" },
      { platform: "抖音", rank: 2, title: "成都美食节启动", heat: "20w", url: "u3" },
    ]);
  });

  it("search 与 /hot 兜底都失败时抛出聚合错误", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchTrendingFromApi("search", { query: "成都" }),
    ).rejects.toThrow(/\/hot 兜底也失败/);
    // /search ×2 + /hot ×1
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
