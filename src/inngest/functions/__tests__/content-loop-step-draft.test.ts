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

// 注：原 Fix ①（IM 出稿建轻量 mission）已按根因撤掉——IM 出稿与 PC 一致，只落稿件库草稿、
// 不建 mission。相关 mission 断言一并删除；下方 gen_draft 出稿后只验回执身份（Fix ②）。
// 出稿成功仍会落库+更新 session，故保留 db/leader 等 mock 防真实加载。

describe("出稿回执身份统一 —— sessionWebhook 优先 / 回落 config", () => {
  beforeEach(() => { wireDb("m1"); });

  it("出稿不再建 mission（不调 getOrProvisionLeader、不 insert missions）", async () => {
    await runContentLoopStep(genDraftData("session-wh"));
    expect(getLeaderMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalledWith(MISSIONS_TBL);
    // 但稿子照常落库（archive_to_drafts）+ 版本留痕 + 更新 session
    expect(appendVersionMock).toHaveBeenCalled();
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({ lastArticleId: "art1" }));
  });

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
