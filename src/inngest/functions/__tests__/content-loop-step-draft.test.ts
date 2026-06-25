import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── hoisted mocks ───
const invokeMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());
const updateSessionMock = vi.hoisted(() => vi.fn());
const appendVersionMock = vi.hoisted(() => vi.fn());
const getLeaderMock = vi.hoisted(() => vi.fn());
const postWebhookMock = vi.hoisted(() => vi.fn());
const sendChannelMock = vi.hoisted(() => vi.fn());
const getChannelConfigMock = vi.hoisted(() => vi.fn());

const insertMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());

// 两张表用带标记的 mock 对象区分（insertMock 据此分派）
const MISSIONS_TBL = vi.hoisted(() => ({ __table: "missions", id: "id" }));
const ARTIFACTS_TBL = vi.hoisted(() => ({ __table: "missionArtifacts" }));
const ARTICLES_TBL = vi.hoisted(() => ({ __table: "articles", id: "id", organizationId: "organizationId" }));

vi.mock("@/lib/agent/tool-registry", () => ({ invokeToolDirectly: invokeMock }));
vi.mock("@/lib/dal/channel-sessions", () => ({
  getSessionById: getSessionMock,
  updateSession: updateSessionMock,
  CONTENT_LOOP_TTL_MS: 604800000,
}));
vi.mock("@/lib/dal/article-versions", () => ({ appendArticleVersion: appendVersionMock }));
vi.mock("@/lib/content/revise", () => ({
  reviseDraft: vi.fn(),
  splitTitleBody: vi.fn((t: string) => ({ title: t.split("\n")[0], body: t })),
  deriveTitle: vi.fn((c: string) => c.split("\n")[0] || "标题"),
}));
vi.mock("@/lib/channels/content-loop/cards", () => ({
  renderHotListCard: vi.fn(() => "hotlist"),
  renderAngleCard: vi.fn(() => "angles"),
  renderDraftCard: vi.fn(() => "draftcard"),
  renderReviewTaskCard: vi.fn(() => "review"),
  renderPublishReceiptCard: vi.fn(() => "publish"),
  renderSpreadCard: vi.fn(() => "spread"),
}));
vi.mock("@/lib/channels/session-webhook", () => ({ postToSessionWebhook: postWebhookMock }));
vi.mock("@/lib/dal/channels", () => ({ getChannelConfig: getChannelConfigMock }));
vi.mock("@/lib/channels/outbound", () => ({ sendChannelMessage: sendChannelMock }));
vi.mock("@/app/actions/missions", () => ({ getOrProvisionLeader: getLeaderMock }));
vi.mock("@/db", () => ({ db: { insert: insertMock, update: updateMock } }));
vi.mock("@/db/schema/missions", () => ({ missions: MISSIONS_TBL, missionArtifacts: ARTIFACTS_TBL }));
vi.mock("@/db/schema/articles", () => ({ articles: ARTICLES_TBL }));

import { runContentLoopStep } from "../content-loop-step";

const channelCtx = {
  organizationId: "o1",
  configId: "c1",
  platform: "dingtalk",
  chatId: "g1",
  externalUserId: "u1",
} as const;

const genDraftData = (replyWebhook?: string) =>
  ({
    organizationId: "o1",
    sessionId: "s1",
    step: "gen_draft",
    channelCtx,
    replyWebhook,
  }) as never;

/** db.insert：missions 表 → returning [{id}]；missionArtifacts 表 → 直通。 */
function wireDb(missionId: string | null) {
  const artifactValuesMock = vi.fn().mockResolvedValue(undefined);
  const missionReturningMock = vi
    .fn()
    .mockResolvedValue(missionId ? [{ id: missionId }] : []);
  insertMock.mockImplementation((table: { __table?: string }) => {
    if (table?.__table === "missions") {
      return {
        values: () => ({ onConflictDoNothing: () => ({ returning: missionReturningMock }) }),
      };
    }
    return { values: artifactValuesMock };
  });
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockReturnValue({ where: whereMock });
  updateMock.mockReturnValue({ set: setMock });
  return { artifactValuesMock, missionReturningMock, setMock, whereMock };
}

beforeEach(() => {
  [
    invokeMock, getSessionMock, updateSessionMock, appendVersionMock, getLeaderMock,
    postWebhookMock, sendChannelMock, getChannelConfigMock, insertMock, updateMock,
  ].forEach((m) => m.mockReset());

  getSessionMock.mockResolvedValue({
    id: "s1",
    organizationId: "o1",
    lastArticleId: null,
    scenarioPhase: "drafting",
    loopContext: {
      selectedTopic: { title: "寒潮来袭", topicId: "t1" },
      selectedAngle: { idx: 1, label: "民生影响" },
    },
  });
  updateSessionMock.mockResolvedValue(undefined);
  appendVersionMock.mockResolvedValue({ versionNo: 1 });
  getLeaderMock.mockResolvedValue({ id: "leader1" });
  getChannelConfigMock.mockResolvedValue(null);
  postWebhookMock.mockResolvedValue({ ok: true });

  invokeMock.mockImplementation((tool: string) => {
    if (tool === "content_generate") {
      return Promise.resolve({ ok: true, result: { content: "正文标题\n正文内容若干", wordCount: 800 } });
    }
    if (tool === "archive_to_drafts") {
      return Promise.resolve({ ok: true, result: { firstArticleId: "art1" } });
    }
    return Promise.resolve({ ok: false, error: "未知工具" });
  });
});

describe("Fix ①：gen_draft 出稿 → 建轻量 completed mission + 关联 article", () => {
  it("成功落稿 → insert(missions) + 回写 article.missionId + insert(missionArtifacts)", async () => {
    const { artifactValuesMock, setMock } = wireDb("m1");

    await runContentLoopStep(genDraftData());

    expect(getLeaderMock).toHaveBeenCalledWith("o1");
    // mission 行用 completed + dingtalk_im 来源 + articleId 去重键
    expect(insertMock).toHaveBeenCalledWith(MISSIONS_TBL);
    // article.missionId 被回写
    expect(setMock).toHaveBeenCalledWith({ missionId: "m1" });
    // 轻量 article_draft artifact 落库
    expect(insertMock).toHaveBeenCalledWith(ARTIFACTS_TBL);
    expect(artifactValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        missionId: "m1",
        producedBy: "leader1",
        type: "article_draft",
        title: expect.any(String),
        metadata: expect.objectContaining({ articleId: "art1", language: "zh" }),
      }),
    );
  });

  it("onConflictDoNothing 命中（returning []）→ 不回写 article、不建 artifact", async () => {
    const { artifactValuesMock, setMock } = wireDb(null); // mission returning 空
    await runContentLoopStep(genDraftData());
    expect(insertMock).toHaveBeenCalledWith(MISSIONS_TBL);
    expect(setMock).not.toHaveBeenCalled(); // 没有 article 回写
    expect(artifactValuesMock).not.toHaveBeenCalled(); // 没有 artifact
  });

  it("建档抛错 → 不阻断出稿（不 throw，仍推初稿卡 + 更新 session）", async () => {
    insertMock.mockImplementation(() => { throw new Error("db down"); });
    getLeaderMock.mockRejectedValue(new Error("leader fail"));

    await expect(runContentLoopStep(genDraftData("wh"))).resolves.toBeUndefined();

    expect(postWebhookMock).toHaveBeenCalledWith(
      "wh",
      expect.objectContaining({ title: "初稿", type: "markdown" }),
    );
    expect(updateSessionMock).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ lastArticleId: "art1" }),
    );
  });
});

describe("Fix ②：pushCard 机器人身份统一 —— sessionWebhook 优先 / 回落 config", () => {
  beforeEach(() => { wireDb("m1"); });

  it("replyWebhook 存在且 POST 成功 → 走 postToSessionWebhook，不碰 sendChannelMessage", async () => {
    postWebhookMock.mockResolvedValue({ ok: true });
    await runContentLoopStep(genDraftData("session-wh"));
    expect(postWebhookMock).toHaveBeenCalledWith(
      "session-wh",
      expect.objectContaining({ title: "初稿" }),
    );
    expect(sendChannelMock).not.toHaveBeenCalled();
  });

  it("replyWebhook 缺省 → 直接走 config 机器人 sendChannelMessage", async () => {
    getChannelConfigMock.mockResolvedValue({ id: "cfg1" });
    await runContentLoopStep(genDraftData(undefined));
    expect(postWebhookMock).not.toHaveBeenCalled();
    expect(sendChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({ config: { id: "cfg1" }, chatId: "g1", title: "初稿" }),
    );
  });

  it("replyWebhook 存在但 POST 失败 → 回落 config 机器人", async () => {
    postWebhookMock.mockResolvedValue({ ok: false, error: "expired" });
    getChannelConfigMock.mockResolvedValue({ id: "cfg1" });
    await runContentLoopStep(genDraftData("expired-wh"));
    expect(postWebhookMock).toHaveBeenCalled();
    expect(sendChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({ config: { id: "cfg1" }, title: "初稿" }),
    );
  });
});
