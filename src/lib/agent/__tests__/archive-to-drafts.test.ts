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
const updateSetMock = vi.hoisted(() => vi.fn(() => ({ where: vi.fn() })));
const valuesMock = vi.hoisted(() => vi.fn(() => ({
  returning: insertMock,
})));

vi.mock("@/db", () => ({
  db: {
    query: { articles: { findFirst: findFirstMock } },
    insert: vi.fn(() => ({
      values: valuesMock,
    })),
    update: vi.fn(() => ({
      set: updateSetMock,
    })),
  },
}));
vi.mock("@/db/schema/articles", () => ({
  articles: {
    organizationId: "x",
    id: "id",
    sourceUrl: "y",
    metadata: "z",
    missionId: "m",
    taskId: "t",
  },
}));

import { invokeToolDirectly } from "../tool-registry";

beforeEach(() => {
  insertMock.mockReset();
  findFirstMock.mockReset();
  updateSetMock.mockClear();
  valuesMock.mockClear();
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

  it("正式 mission 入库时写入 articles.missionId，并把 mission task id 放入 metadata", async () => {
    findFirstMock.mockResolvedValue(null);
    insertMock.mockResolvedValueOnce([{ id: "a1", title: "T1" }]);
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        { title: "T1", body: "Body 1 with enough chars", sourceUrl: "https://a.com/1" },
      ],
    }, {
      organizationId: "org1",
      operatorId: "u1",
      missionId: "mission-1",
      taskId: "task-1",
    });

    expect(res.ok).toBe(true);
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        missionId: "mission-1",
        metadata: expect.objectContaining({
          workflowTaskId: "task-1",
        }),
      }),
    );
    expect(valuesMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
      }),
    );
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
      created: Array<{ articleId: string; status: string }>;
      inserted: Array<{ articleId: string; status: string }>;
      articles: Array<{ articleId: string; status: string }>;
      skipped: unknown[];
      firstArticleId: string | null;
      firstTitle: string | null;
    };
    expect(result.totalCreated).toBe(1);
    expect(result.totalSkipped).toBe(1);
    expect((result.skipped[0] as { existingArticleId: string }).existingArticleId).toBe("existing1");
    expect(result.inserted).toEqual([
      { articleId: "a2", title: "T2", sourceUrl: "https://a.com/new", status: "created" },
    ]);
    // created 是下游兼容字段，表示“本次可用稿件”，包含已存在和新建稿件。
    expect(result.created.map((item) => item.articleId)).toEqual(["existing1", "a2"]);
    expect(result.articles.map((item) => item.status)).toEqual(["existing", "created"]);
    expect(result.firstArticleId).toBe("existing1");
    expect(result.firstTitle).toBe("Old");
  });

  it("全被去重 skip 时仍返回可供下游发布的已有稿件 articleId", async () => {
    findFirstMock.mockResolvedValueOnce({ id: "existing1", title: "Old" });
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        { title: "T1", body: "Body 1 with enough chars", sourceUrl: "https://a.com/dup" },
      ],
    }, { organizationId: "org1", operatorId: "u1" });
    if (!res.ok) throw new Error("not ok");
    const result = res.result as {
      totalCreated: number;
      totalSkipped: number;
      totalAvailable: number;
      created: Array<{ articleId: string; status: string }>;
      inserted: Array<{ articleId: string }>;
      firstArticleId: string | null;
      firstTitle: string | null;
    };
    expect(result.totalCreated).toBe(0);
    expect(result.totalSkipped).toBe(1);
    expect(result.totalAvailable).toBe(1);
    expect(result.inserted).toEqual([]);
    expect(result.created).toEqual([
      { articleId: "existing1", title: "Old", sourceUrl: "https://a.com/dup", status: "existing" },
    ]);
    expect(result.firstArticleId).toBe("existing1");
    expect(result.firstTitle).toBe("Old");
  });

  it("去重命中测试运行遗留稿件时，为正式 mission 补写 missionId", async () => {
    findFirstMock.mockResolvedValueOnce({
      id: "existing1",
      title: "Old",
      missionId: null,
    });

    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        { title: "T1", body: "Body 1 with enough chars", sourceUrl: "https://a.com/dup" },
      ],
    }, {
      organizationId: "org1",
      operatorId: "u1",
      missionId: "mission-1",
    });

    expect(res.ok).toBe(true);
    expect(updateSetMock).toHaveBeenCalledWith({
      missionId: "mission-1",
    });
  });

  it("dryRun=true 直接 return mock，不调 insert", async () => {
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [{ title: "T", body: "Body with enough chars" }],
      dryRun: true,
    }, { organizationId: "org1", operatorId: "u1" });
    if (!res.ok) throw new Error("not ok");
    const result = res.result as {
      dryRun?: boolean;
      totalCreated: number;
      created: Array<{ articleId: string }>;
    };
    expect(result.dryRun).toBe(true);
    expect(result.totalCreated).toBe(1);
    expect(result.created[0].articleId).toBe("00000000-0000-4000-8000-000000000001");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("拒绝 cross_language_rewrite 的 NEEDS REVIEW 兜底稿，不入库", async () => {
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        {
          title: "[NEEDS REVIEW] 海底捞宣布小料台牛肉粒回归",
          body:
            "[NEEDS REVIEW] LLM did not return a rewrite for this article. Original Chinese body preserved:\n\n海底捞宣布小料台牛肉粒回归，全国门店恢复供应。",
          sourceUrl: "https://www.zhihu.com/question/2042642736826816309",
          language: "en",
        },
      ],
    }, { organizationId: "org1", operatorId: "u1" });

    if (!res.ok) throw new Error("not ok");
    const result = res.result as {
      success: boolean;
      totalCreated: number;
      failed: Array<{ reason: string; title: string }>;
      error?: { code: string };
    };
    expect(result.success).toBe(false);
    expect(result.totalCreated).toBe(0);
    expect(result.failed[0]).toMatchObject({
      reason: "needs_review_fallback",
      title: "[NEEDS REVIEW] 海底捞宣布小料台牛肉粒回归",
    });
    expect(result.error?.code).toBe("invalid_archive_input");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("部分稿件无效时跳过坏稿，仍入库有效英文稿", async () => {
    findFirstMock.mockResolvedValueOnce(null);
    insertMock.mockResolvedValueOnce([{ id: "valid1", title: "Good English draft" }]);

    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        {
          title: "Good English draft",
          body: "This is a complete English rewrite that should be archived.",
          sourceUrl: "https://example.com/good",
          language: "en",
        },
        {
          title: "[NEEDS REVIEW] 海底捞宣布小料台牛肉粒回归",
          body:
            "[NEEDS REVIEW] LLM did not return a rewrite for this article. Original Chinese body preserved:\n\n海底捞宣布小料台牛肉粒回归，全国门店恢复供应。",
          sourceUrl: "https://example.com/bad",
          language: "en",
        },
      ],
    }, { organizationId: "org1", operatorId: "u1" });

    if (!res.ok) throw new Error("not ok");
    const result = res.result as {
      success: boolean;
      totalCreated: number;
      totalFailed: number;
      created: Array<{ articleId: string }>;
      failed: Array<{ reason: string; title: string }>;
      warning?: { code: string };
    };
    expect(result.success).toBe(true);
    expect(result.totalCreated).toBe(1);
    expect(result.totalFailed).toBe(1);
    expect(result.created).toEqual([
      {
        articleId: "valid1",
        title: "Good English draft",
        sourceUrl: "https://example.com/good",
        status: "created",
      },
    ]);
    expect(result.failed[0]).toMatchObject({
      reason: "needs_review_fallback",
      title: "[NEEDS REVIEW] 海底捞宣布小料台牛肉粒回归",
    });
    expect(result.warning?.code).toBe("partial_invalid_archive_input");
    expect(insertMock).toHaveBeenCalledTimes(1);
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
