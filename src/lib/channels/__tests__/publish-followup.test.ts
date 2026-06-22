import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { dbUpdate, dbSelect, publishArticleToCms, CmsConfigError } = vi.hoisted(() => {
  class CmsConfigError extends Error {
    constructor(msg: string) { super(msg); this.name = "CmsConfigError"; }
  }

  const dbUpdate = vi.fn();
  const dbSelect = vi.fn();

  const publishArticleToCms = vi.fn();

  return { dbUpdate, dbSelect, publishArticleToCms, CmsConfigError };
});

vi.mock("@/db", () => ({
  db: { update: dbUpdate, select: dbSelect },
}));

vi.mock("@/db/schema", () => ({
  articles: { id: "id", organizationId: "organizationId", status: "status" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ op: "and", args }),
  eq: (col: unknown, val: unknown) => ({ op: "eq", col, val }),
  inArray: (col: unknown, vals: unknown) => ({ op: "inArray", col, vals }),
}));

vi.mock("@/lib/cms", () => ({
  publishArticleToCms,
  CmsConfigError,
}));

import { handlePublishConfirm } from "../publish-followup";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const channelCtx = {
  organizationId: "org1",
  configId: "cfg1",
  platform: "dingtalk" as const,
  chatId: "c1",
  externalUserId: "u1",
};

const pendingPublish = {
  articleId: "art1",
  articleTitle: "测试文章",
  catalogName: "新闻",
  target: { catalogId: 101, appId: 1, siteId: 1 },
};

const session = {
  id: "s1",
  organizationId: "org1",
  configId: "cfg1",
  platform: "dingtalk" as const,
  chatId: "c1",
  externalUserId: "u1",
  status: "confirming" as const,
  activeMissionId: null,
  clarifyRounds: 0,
  contextTurns: [],
  pendingPlan: null,
  lastArticleId: "art1",
  pendingPublish,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** db.select().from().where().limit() → resolves to the given rows. */
function mockSelect(rows: Array<{ status: string }>) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  dbSelect.mockReturnValue({ from });
}

beforeEach(() => {
  vi.clearAllMocks();

  // db.update().set().where() → resolves undefined
  const updWhere = vi.fn().mockResolvedValue(undefined);
  const updSet = vi.fn().mockReturnValue({ where: updWhere });
  dbUpdate.mockReturnValue({ set: updSet });

  // db.select() chain — default: current status is "draft" (bumpable)
  mockSelect([{ status: "draft" }]);
});

describe("handlePublishConfirm", () => {
  it("成功 → db.update(置 approved) 先于 publishArticleToCms，回含 publishedUrl", async () => {
    publishArticleToCms.mockResolvedValue({
      success: true,
      publicationId: "pub1",
      cmsState: "submitted",
      publishedUrl: "https://cms.example.com/news/1",
      timings: { totalMs: 100, mappingMs: 10, httpMs: 80 },
    });

    const r = await handlePublishConfirm(session, channelCtx);

    // db.update 必须调用
    expect(dbUpdate).toHaveBeenCalled();
    // publishArticleToCms 必须调用，且 operatorId 为 channel_system
    expect(publishArticleToCms).toHaveBeenCalledWith(
      expect.objectContaining({
        articleId: "art1",
        operatorId: "channel_system",
        triggerSource: "manual",
        allowUpdate: true,
        target: { catalogId: 101, appId: 1, siteId: 1 },
      }),
    );
    // db.update 调用顺序先于 publishArticleToCms（先 bump 再 publish）
    expect(dbUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      publishArticleToCms.mock.invocationCallOrder[0],
    );
    // 成功只 bump 一次，不回滚
    expect(dbUpdate).toHaveBeenCalledTimes(1);
    // 回复含发布 URL + ok:true
    expect(r.ok).toBe(true);
    expect(r.reply).toContain("已发布");
    expect(r.reply).toContain("新闻");
    expect(r.reply).toContain("https://cms.example.com/news/1");
  });

  it("publishArticleToCms 成功但无 publishedUrl → 回含 previewUrl + ok:true", async () => {
    publishArticleToCms.mockResolvedValue({
      success: true,
      publicationId: "pub1",
      cmsState: "submitted",
      previewUrl: "https://preview.example.com/1",
      timings: { totalMs: 100, mappingMs: 10, httpMs: 80 },
    });

    const r = await handlePublishConfirm(session, channelCtx);
    expect(r.ok).toBe(true);
    expect(r.reply).toContain("preview.example.com");
  });

  it("publishArticleToCms 成功但无任何 URL → 回含'审核中' + ok:true", async () => {
    publishArticleToCms.mockResolvedValue({
      success: true,
      publicationId: "pub1",
      cmsState: "submitted",
      timings: { totalMs: 100, mappingMs: 10, httpMs: 80 },
    });

    const r = await handlePublishConfirm(session, channelCtx);
    expect(r.ok).toBe(true);
    expect(r.reply).toContain("审核中");
  });

  it("普通 Error → 回'发布失败' + ok:false + db.update 调两次（bump + 回滚到 draft）", async () => {
    mockSelect([{ status: "draft" }]);
    publishArticleToCms.mockRejectedValue(new Error("network timeout"));

    const r = await handlePublishConfirm(session, channelCtx);

    expect(r.ok).toBe(false);
    expect(r.reply).toContain("发布失败");
    expect(r.reply).toContain("network timeout");
    // bump（→ approved）+ 回滚（→ draft）
    expect(dbUpdate).toHaveBeenCalledTimes(2);
    const rollbackSet = dbUpdate.mock.results[1].value.set;
    expect(rollbackSet).toHaveBeenCalledWith({ status: "draft" });
  });

  it("CmsConfigError → 回'未开启发布' + ok:false + 回滚", async () => {
    mockSelect([{ status: "reviewing" }]);
    publishArticleToCms.mockRejectedValue(new CmsConfigError("feature flag disabled"));

    const r = await handlePublishConfirm(session, channelCtx);

    expect(r.ok).toBe(false);
    expect(r.reply).toContain("未开启");
    // bump + 回滚到 reviewing
    expect(dbUpdate).toHaveBeenCalledTimes(2);
    const rollbackSet = dbUpdate.mock.results[1].value.set;
    expect(rollbackSet).toHaveBeenCalledWith({ status: "reviewing" });
  });

  it("原状态已 approved（无需 bump）→ 失败时不回滚", async () => {
    mockSelect([{ status: "approved" }]);
    publishArticleToCms.mockRejectedValue(new Error("boom"));

    const r = await handlePublishConfirm(session, channelCtx);

    expect(r.ok).toBe(false);
    // 既未 bump 也未回滚（状态本就是 approved）
    expect(dbUpdate).not.toHaveBeenCalled();
  });

  it("pendingPublish 为 null → 回'没有待发布' + ok:false", async () => {
    const r = await handlePublishConfirm({ ...session, pendingPublish: null }, channelCtx);
    expect(r.ok).toBe(false);
    expect(r.reply).toContain("没有待发布");
    expect(publishArticleToCms).not.toHaveBeenCalled();
  });
});
