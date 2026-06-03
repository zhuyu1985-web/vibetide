import { describe, it, expect, vi, beforeEach } from "vitest";

// 轻量单元测试：只验证模块定义 + fn ID 注册正确。
// Inngest handler 的完整集成测试（构造 { event, step, logger } 上下文）由 Task 5.2 手工联调覆盖。

vi.mock("@/db", () => {
  const items = [
    {
      id: "ci-1",
      externalId: "ex1",
      title: "t1",
      sourceUrl: "u1",
      viewCount: 100,
      likeCount: 1,
      contentFingerprint: "fp1",
    },
    {
      id: "ci-2",
      externalId: "ex2",
      title: "t2",
      sourceUrl: "u2",
      viewCount: 200,
      likeCount: 2,
      contentFingerprint: "fp2",
    },
  ];
  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        }),
      }),
      execute: vi.fn().mockResolvedValue([{ id: "mp-new", is_new: true }]),
      query: {
        collectionSources: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        myAccounts: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        benchmarkAccounts: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    },
    // 把 items 也导出给 mock 引用（实际未用，仅保证 mock 完整）
    _mockItems: items,
  };
});

vi.mock("@/lib/topic-compare/sync-collected", () => ({
  syncCollectedItems: vi.fn().mockResolvedValue({
    skipped: false,
    processed: 2,
    succeeded: 2,
    parseFailed: 0,
    upserted: 2,
    newMyPostIds: ["mp-new"],
  }),
}));

import { topicCompareSyncFromCollection } from "../sync-on-run-completed";

beforeEach(() => vi.clearAllMocks());

describe("topicCompareSyncFromCollection", () => {
  it("函数已经被正确定义且 register-able", () => {
    expect(topicCompareSyncFromCollection).toBeDefined();
    // Inngest createFunction 返回的对象，.id() 是方法（method），不是属性
    const fnObj = topicCompareSyncFromCollection as { id: (prefix?: string) => string };
    expect(typeof fnObj.id).toBe("function");
    expect(fnObj.id()).toContain("sync-on-run-completed");
  });
});
