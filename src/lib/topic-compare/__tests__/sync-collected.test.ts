import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => {
  const upsertCalls: Array<{ table: string; values: unknown }> = [];
  const fakeOnConflict = vi.fn().mockResolvedValue([]);
  const fakeValues = vi.fn().mockImplementation((vals: unknown) => {
    return { onConflictDoUpdate: fakeOnConflict.mockImplementation(() => { upsertCalls.push({ table: "tbd", values: vals }); return Promise.resolve([]); }) };
  });
  const fakeInsert = vi.fn().mockImplementation((tbl: { _tableName?: string }) => {
    return { values: fakeValues };
  });
  return {
    db: { insert: fakeInsert },
    __upsertCalls: upsertCalls,
  };
});

import { syncCollectedItems } from "../sync-collected";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncCollectedItems — benchmark binding", () => {
  it("非白名单平台整批 skip", async () => {
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "benchmark", platform: "xiaohongshu", benchmarkAccountId: "ba-1" },
      items: [{ externalId: "x1", title: "t", sourceUrl: "u", views: 0, likes: 0 } as any],
    });
    expect(result).toEqual({
      skipped: true,
      skipReason: "platform_not_supported",
      processed: 0,
      succeeded: 0,
      parseFailed: 0,
      upserted: 0,
      newMyPostIds: [],
    });
  });

  it("白名单平台 benchmark item 调 insert(benchmark_posts)", async () => {
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "benchmark", platform: "douyin", benchmarkAccountId: "ba-1" },
      items: [
        {
          externalId: "x1",
          title: "测试标题",
          sourceUrl: "https://example.com/x1",
          views: 100,
          likes: 10,
          shares: 1,
          comments: 2,
          publishedAt: new Date("2026-06-01T00:00:00Z"),
          contentFingerprint: "fp1",
        } as any,
      ],
    });
    expect(result.processed).toBe(1);
    expect(result.upserted).toBe(1);
    expect(result.parseFailed).toBe(0);
    expect(result.newMyPostIds).toEqual([]);
  });

  it("解析失败的 item(缺 title) 计入 parseFailed,不阻塞其他", async () => {
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "benchmark", platform: "douyin", benchmarkAccountId: "ba-1" },
      items: [
        { externalId: "ok", title: "正常", sourceUrl: "u1" } as any,
        { externalId: "bad" } as any, // 缺 title
        { externalId: "ok2", title: "正常 2", sourceUrl: "u2" } as any,
      ],
    });
    expect(result.processed).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.parseFailed).toBe(1);
    expect(result.upserted).toBe(2);
  });
});
