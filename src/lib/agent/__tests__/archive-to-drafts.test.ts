/**
 * Task 4.2 — archive_to_drafts tool 单测
 *
 * 4 case：
 *   1. 批量入库 N 条 articles，正常路径
 *   2. sourceUrl 已存在 → skip，不入库
 *   3. dryRun=true → 直接 return mock，不调 DB
 *   4. 缺 organizationId → 报错
 *
 * 通过 vi.hoisted mock db / schema，避免真连库。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.hoisted(() => vi.fn());
const findFirstMock = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({
  db: {
    query: { articles: { findFirst: findFirstMock } },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: insertMock,
      })),
    })),
  },
}));
vi.mock("@/db/schema/articles", () => ({ articles: { organizationId: "x", sourceUrl: "y", metadata: "z" } }));

import { invokeToolDirectly } from "../tool-registry";

beforeEach(() => {
  insertMock.mockReset();
  findFirstMock.mockReset();
});

describe("archive_to_drafts", () => {
  it("批量入库 N 条 articles，sourceUrl 落库", async () => {
    findFirstMock.mockResolvedValue(null);  // 无重复
    insertMock
      .mockResolvedValueOnce([{ id: "a1", title: "T1" }])
      .mockResolvedValueOnce([{ id: "a2", title: "T2" }]);
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        { title: "T1", body: "Body 1 with enough chars", sourceUrl: "https://a.com/1" },
        { title: "T2", body: "Body 2 with enough chars", sourceUrl: "https://a.com/2" },
      ],
    }, { organizationId: "org1", operatorId: "u1" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("not ok");
    const result = res.result as {
      totalCreated: number;
      totalSkipped: number;
      firstArticleId: string | null;
      firstTitle: string | null;
    };
    expect(result.totalCreated).toBe(2);
    expect(result.totalSkipped).toBe(0);
    // 顶层便利字段：方便单文章串联 {{stepN.firstArticleId}}
    expect(result.firstArticleId).toBe("a1");
    expect(result.firstTitle).toBe("T1");
  });

  it("sourceUrl 已存在则 skip 不入库", async () => {
    findFirstMock
      .mockResolvedValueOnce({ id: "existing1", title: "Old" })
      .mockResolvedValueOnce(null);
    insertMock.mockResolvedValueOnce([{ id: "a2", title: "T2" }]);
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        { title: "T1", body: "Body 1 with enough chars", sourceUrl: "https://a.com/dup" },
        { title: "T2", body: "Body 2 with enough chars", sourceUrl: "https://a.com/new" },
      ],
    }, { organizationId: "org1", operatorId: "u1" });
    if (!res.ok) throw new Error("not ok");
    const result = res.result as {
      totalCreated: number;
      totalSkipped: number;
      skipped: unknown[];
      firstArticleId: string | null;
      firstTitle: string | null;
    };
    expect(result.totalCreated).toBe(1);
    expect(result.totalSkipped).toBe(1);
    expect((result.skipped[0] as { existingArticleId: string }).existingArticleId).toBe("existing1");
    // 第一条被 skip 后，firstArticleId 取实际写入的第二条
    expect(result.firstArticleId).toBe("a2");
    expect(result.firstTitle).toBe("T2");
  });

  it("全被 skip（created.length === 0）→ firstArticleId / firstTitle 为 null", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "existing1", title: "Old" });
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        { title: "T1", body: "Body 1 with enough chars", sourceUrl: "https://a.com/dup" },
      ],
    }, { organizationId: "org1", operatorId: "u1" });
    if (!res.ok) throw new Error("not ok");
    const result = res.result as {
      totalCreated: number;
      firstArticleId: string | null;
      firstTitle: string | null;
    };
    expect(result.totalCreated).toBe(0);
    expect(result.firstArticleId).toBeNull();
    expect(result.firstTitle).toBeNull();
  });

  it("dryRun=true 直接 return mock，不调 insert", async () => {
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [{ title: "T", body: "Body with enough chars" }],
      dryRun: true,
    }, { organizationId: "org1", operatorId: "u1" });
    if (!res.ok) throw new Error("not ok");
    const result = res.result as { dryRun?: boolean };
    expect(result.dryRun).toBe(true);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("缺 organizationId 报错", async () => {
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [{ title: "T", body: "Body with enough chars" }],
    }, {});
    if (res.ok) {
      const result = res.result as { success: boolean };
      expect(result.success).toBe(false);
    }
  });
});
