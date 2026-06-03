import { describe, it, expect, vi } from "vitest";
import { backfillAccount } from "../backfill";

vi.mock("@/lib/topic-compare/sync-collected", () => ({
  syncCollectedItems: vi.fn().mockResolvedValue({
    skipped: false,
    processed: 30,
    succeeded: 30,
    parseFailed: 0,
    upserted: 30,
    newMyPostIds: ["mp-1", "mp-2"],
  }),
}));

// mock tikhubFetch (底层 HTTP client)
vi.mock("@/lib/collection/adapters/tikhub/http-client", () => ({
  tikhubFetch: vi.fn().mockResolvedValue({
    data: {
      data: {
        aweme_list: Array.from({ length: 30 }, (_, i) => ({
          aweme_id: `ext-${i}`,
          desc: `帖子${i}`,
          share_url: `https://www.douyin.com/video/ext-${i}`,
          statistics: {
            digg_count: i,
            comment_count: i * 2,
            share_count: i * 3,
            play_count: i * 10,
          },
          create_time: 1748700000 + i,
        })),
      },
    },
    costUsd: 0.005,
    endpoint: "/api/v1/douyin/web/fetch_user_post_videos",
  }),
}));

describe("backfillAccount", () => {
  it("调一次 TikHub 拿到 30 条 → 喂给 sync → 返回统计", async () => {
    const result = await backfillAccount({
      organizationId: "org-1",
      kind: "my",
      accountId: "ma-1",
      platform: "douyin",
      handle: "test_user",
    });
    expect(result.skipped).toBe(false);
    expect(result.itemsFetched).toBe(30);
    expect(result.newMyPostIds.length).toBe(2);
  });

  it("非白名单平台直接 skip，不调 TikHub", async () => {
    const result = await backfillAccount({
      organizationId: "org-1",
      kind: "benchmark",
      accountId: "ba-1",
      platform: "xiaohongshu",
      handle: "x",
    });
    expect(result.skipped).toBe(true);
    expect(result.itemsFetched).toBe(0);
  });
});
