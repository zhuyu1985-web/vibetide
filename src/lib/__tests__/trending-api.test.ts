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
});
