import { describe, expect, it, vi, beforeEach } from "vitest";
import { tikhubAdapter } from "..";
import * as httpClient from "../http-client";

vi.mock("../http-client");

describe("tikhubAdapter.execute", () => {
  beforeEach(() => vi.clearAllMocks());

  it("douyin: 多关键词多页，早停后调用次数 = 关键词数", async () => {
    vi.spyOn(httpClient, "tikhubFetch").mockResolvedValue({
      data: { data: { data: [] } },
      costUsd: 0.005,
      endpoint: "/api/v1/douyin/app/v3/fetch_general_search_result",
    });

    const result = await tikhubAdapter.execute({
      config: {
        platform: "douyin",
        searchType: "keyword",
        keywords: ["a", "b"],
        timeWindow: "halfYear",
        maxPagesPerRun: 2,
        resultsPerPage: 20,
        monthlyBudgetUsd: 1,
      },
      log: vi.fn(),
      runId: "test-run",
      sourceId: "test-source",
      organizationId: "test-org",
    } as never);

    // 每页返回 0 items < 20 * 0.5 = 10 → 早停，每个关键词只调用 1 次
    // 2 关键词 × 1 页 = 2 次
    expect(httpClient.tikhubFetch).toHaveBeenCalledTimes(2);
    expect(result.items).toHaveLength(0);
    expect(result.partialFailures).toHaveLength(0);
    expect(result.runMetadata).toMatchObject({ tikhubPlatform: "douyin" });
  });

  it("超预算（estimated > budget）抛错且不调用 API", async () => {
    const mockFetch = vi.spyOn(httpClient, "tikhubFetch");

    await expect(
      tikhubAdapter.execute({
        config: {
          platform: "douyin",
          searchType: "keyword",
          keywords: Array(20).fill("a"),
          timeWindow: "halfYear",
          maxPagesPerRun: 10,
          resultsPerPage: 20,
          monthlyBudgetUsd: 0.1,
        },
        log: vi.fn(),
        runId: "test-run",
        sourceId: "test-source",
        organizationId: "test-org",
      } as never),
    ).rejects.toThrow(/exceeds monthly budget/);

    // 超预算应该在调用 API 之前就抛错
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
