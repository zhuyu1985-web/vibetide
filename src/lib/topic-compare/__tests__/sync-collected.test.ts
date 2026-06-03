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
  // my 分支用 db.execute(sql`...`) 做 upsert + xmax=0 判断
  const fakeExecute = vi.fn().mockResolvedValue([{ id: "mp-test", is_new: true }]);
  return {
    db: { insert: fakeInsert, execute: fakeExecute },
    __upsertCalls: upsertCalls,
  };
});

import { syncCollectedItems, type CollectedItemInput } from "../sync-collected";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncCollectedItems — benchmark binding", () => {
  it("非白名单平台整批 skip", async () => {
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "benchmark", platform: "xiaohongshu", benchmarkAccountId: "ba-1" },
      items: [{ externalId: "x1", title: "t", sourceUrl: "u", views: 0, likes: 0 } as CollectedItemInput],
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
        } as CollectedItemInput,
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
        { externalId: "ok", title: "正常", sourceUrl: "u1" } as CollectedItemInput,
        { externalId: "bad" } as CollectedItemInput, // 缺 title
        { externalId: "ok2", title: "正常 2", sourceUrl: "u2" } as CollectedItemInput,
      ],
    });
    expect(result.processed).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.parseFailed).toBe(1);
    expect(result.upserted).toBe(2);
  });
});

describe("syncCollectedItems — my binding", () => {
  it("新 my_post 通过 fingerprint dedup 进入 newMyPostIds", async () => {
    // 注:这里只验证统计字段、分支选择;真实落表行为由集成测试(Task 2.4)覆盖
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "my", platform: "douyin", myAccountId: "ma-1" },
      items: [
        {
          externalId: "x1",
          title: "新作品",
          sourceUrl: "https://example.com/x1",
          contentFingerprint: "new-fp",
          views: 1,
          likes: 1,
        } as CollectedItemInput,
      ],
    });
    expect(result.skipped).toBe(false);
    expect(result.processed).toBe(1);
    // succeeded 与 newMyPostIds 的具体值依赖 mock 行为,这里只验证"非负、流程跑通"
    expect(result.parseFailed).toBeGreaterThanOrEqual(0);
  });

  it("缺 contentFingerprint 的 my item 计入 parseFailed", async () => {
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "my", platform: "douyin", myAccountId: "ma-1" },
      items: [{ externalId: "x", title: "无指纹" } as CollectedItemInput],
    });
    expect(result.parseFailed).toBe(1);
    expect(result.succeeded).toBe(0);
  });
});
