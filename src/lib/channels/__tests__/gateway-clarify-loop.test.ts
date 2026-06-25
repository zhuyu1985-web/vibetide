import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getOrCreateSession,
  updateSession,
  resetSession,
  clarifyOrPlan,
  startChannelMission,
  cancelChannelMission,
  recordInboundMessage,
  recordOutboundMessage,
  resolveCatalogByName,
  listAllActiveCmsCatalogs,
  getArticleById,
  handlePublishConfirm,
  inngestSend,
} = vi.hoisted(() => ({
  getOrCreateSession: vi.fn(),
  updateSession: vi.fn(),
  resetSession: vi.fn(),
  clarifyOrPlan: vi.fn(),
  startChannelMission: vi.fn(),
  cancelChannelMission: vi.fn(),
  recordInboundMessage: vi.fn().mockResolvedValue({ messageId: "x" }),
  recordOutboundMessage: vi.fn().mockResolvedValue({ messageId: "y" }),
  resolveCatalogByName: vi.fn(),
  listAllActiveCmsCatalogs: vi.fn(),
  getArticleById: vi.fn(),
  handlePublishConfirm: vi.fn(),
  inngestSend: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/dal/channel-sessions", () => ({
  getOrCreateSession,
  updateSession,
  resetSession,
}));
vi.mock("@/lib/channels/clarify-or-plan", () => ({ clarifyOrPlan }));
vi.mock("@/lib/channels/start-channel-mission", () => ({ startChannelMission }));
vi.mock("@/lib/channels/cancel-channel-mission", () => ({ cancelChannelMission }));
vi.mock("@/app/actions/channels", () => ({ recordInboundMessage, recordOutboundMessage }));

// Mock modules used by other gateway branches (not under test)
vi.mock("@/lib/agent/intent-recognition", () => ({ recognizeIntent: vi.fn() }));
vi.mock("@/lib/constants", () => ({ EMPLOYEE_META: { xiaolei: { name: "小蕾", nickname: "小蕾", title: "热搜猎手" } } }));
vi.mock("@/lib/dal/workflow-templates-listing", () => ({ findTemplateByNameOrSlug: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: { send: inngestSend } }));
vi.mock("@/lib/channels/link-extract", () => ({ extractUrls: vi.fn().mockReturnValue([]) }));

// Mocks for publish follow-up path
vi.mock("@/lib/dal/cms-catalogs", () => ({ resolveCatalogByName, listAllActiveCmsCatalogs }));
vi.mock("@/lib/dal/articles", () => ({ getArticleById }));
vi.mock("@/lib/channels/publish-followup", () => ({ handlePublishConfirm }));

import { handleInboundMessage } from "../gateway";

const msg = {
  platform: "dingtalk" as const,
  configId: "cfg1",
  organizationId: "org1",
  externalMessageId: "m1",
  externalUserId: "u1",
  chatId: "c1",
  textContent: "帮我搞个东西",
  rawMessage: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gateway 自由消息澄清循环", () => {
  it("running + 非取消词 → 回'处理中'含取消提示，不调 clarifyOrPlan/cancel/reset", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: "m1", contextTurns: [], clarifyRounds: 0 });
    const r = await handleInboundMessage(msg);
    expect(r.reply).toContain("处理中");
    expect(r.reply).toContain("取消");
    expect(clarifyOrPlan).not.toHaveBeenCalled();
    expect(cancelChannelMission).not.toHaveBeenCalled();
    expect(resetSession).not.toHaveBeenCalled();
  });

  it("running + 取消 → cancelChannelMission + resetSession + 回已取消", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: "m1", contextTurns: [], clarifyRounds: 0 });
    cancelChannelMission.mockResolvedValue(true);
    const r = await handleInboundMessage({ ...msg, textContent: "取消" });
    expect(cancelChannelMission).toHaveBeenCalledWith("m1", "org1");
    expect(resetSession).toHaveBeenCalled();
    expect(startChannelMission).not.toHaveBeenCalled();
    expect(r.reply).toContain("已取消");
  });

  it("running + 取消 但 cancel 返回 false（已终态）→ 回任务已结束", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: "m1", contextTurns: [], clarifyRounds: 0 });
    cancelChannelMission.mockResolvedValue(false);
    const r = await handleInboundMessage({ ...msg, textContent: "取消" });
    expect(resetSession).toHaveBeenCalled();
    expect(r.reply).toContain("已结束");
  });

  it("running + 取消 但 activeMissionId 空 → 仅 resetSession，不调 cancelChannelMission", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: null, contextTurns: [], clarifyRounds: 0 });
    const r = await handleInboundMessage({ ...msg, textContent: "取消" });
    expect(cancelChannelMission).not.toHaveBeenCalled();
    expect(resetSession).toHaveBeenCalled();
    expect(r.reply).toContain("已结束");
  });

  it("clarify → 回问题，session=clarifying，轮数+1", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1",
      status: "idle",
      contextTurns: [],
      clarifyRounds: 0,
    });
    clarifyOrPlan.mockResolvedValue({ action: "clarify", question: "针对哪个平台？" });
    const r = await handleInboundMessage(msg);
    expect(r.reply).toContain("针对哪个平台");
    expect(updateSession).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ status: "clarifying", clarifyRounds: 1 }),
    );
  });

  it("execute → 进 confirming 发计划卡，不直接起 mission", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0 });
    clarifyOrPlan.mockResolvedValue({ action: "execute", summary: "抓热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓热点" }] });
    const r = await handleInboundMessage(msg);
    expect(startChannelMission).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "confirming" }));
    expect(r.reply).toContain("开始");
  });

  it("confirming + 开始 → 起 mission，running，清 pendingPlan", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0,
      pendingPlan: { summary: "抓热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓热点" }] } });
    startChannelMission.mockResolvedValue({ missionId: "mis1" });
    const r = await handleInboundMessage({ ...msg, textContent: "开始" });
    expect(startChannelMission).toHaveBeenCalled();
    // 去重 key：必须传当前这条「开始」消息的 externalMessageId，进 missions_source_dedup_uidx 做幂等
    expect(startChannelMission).toHaveBeenCalledWith("org1", expect.objectContaining({ externalMessageId: "m1" }));
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "running", activeMissionId: "mis1", pendingPlan: null }));
    expect(r.reply).toContain("收到");
  });

  it("confirming + 取消 → idle，清 pendingPlan，不起 mission", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0, pendingPlan: { summary: "x", steps: [] } });
    const r = await handleInboundMessage({ ...msg, textContent: "取消" });
    expect(startChannelMission).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "idle", pendingPlan: null }));
    expect(r.reply).toContain("取消");
  });

  it("confirming + 编辑 → 重规划更新 pendingPlan 回新卡，留 confirming", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0, pendingPlan: { summary: "科技", steps: [] } });
    clarifyOrPlan.mockResolvedValue({ action: "execute", summary: "财经热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓财经热榜" }] });
    const r = await handleInboundMessage({ ...msg, textContent: "换财经" });
    expect(startChannelMission).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "confirming", pendingPlan: expect.objectContaining({ summary: "财经热点" }) }));
    expect(r.reply).toContain("抓财经热榜");
  });
});

describe("gateway 发布 follow-up 分支", () => {
  beforeEach(() => {
    updateSession.mockResolvedValue(undefined);
    handlePublishConfirm.mockResolvedValue({ reply: "✅ 已发布到「新闻」：https://example.com/1", ok: true });
  });

  it("idle + lastArticleId + 发布意图 + 栏目命中 + org 一致 → confirming + pendingPublish，不调 handlePublishConfirm", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0,
      pendingPlan: null, pendingPublish: null, lastArticleId: "art1",
    });
    resolveCatalogByName.mockResolvedValue({ catalogId: 101, appId: 1, siteId: 1, name: "新闻" });
    getArticleById.mockResolvedValue({ id: "art1", title: "测试文章", organizationId: "org1", publishStatus: "approved" });

    const r = await handleInboundMessage({ ...msg, textContent: "把这篇发布到新闻" });

    expect(handlePublishConfirm).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        status: "confirming",
        pendingPlan: null,
        pendingPublish: expect.objectContaining({ catalogName: "新闻", articleId: "art1" }),
      }),
    );
    expect(r.reply).toContain("确认");
  });

  it("idle + 无 lastArticleId + 发布意图 → 回'没有可发布的稿件'，不 updateSession", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0,
      pendingPlan: null, pendingPublish: null, lastArticleId: null,
    });

    const r = await handleInboundMessage({ ...msg, textContent: "发布到新闻" });
    expect(r.reply).toContain("没有可发布的稿件");
    expect(updateSession).not.toHaveBeenCalled();
    expect(handlePublishConfirm).not.toHaveBeenCalled();
  });

  it("idle + lastArticleId + 发布意图 + 栏目未命中 → 回含'没找到'", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0,
      pendingPlan: null, pendingPublish: null, lastArticleId: "art1",
    });
    resolveCatalogByName.mockResolvedValue(null);
    listAllActiveCmsCatalogs.mockResolvedValue([
      { name: "体育" }, { name: "娱乐" },
    ]);

    const r = await handleInboundMessage({ ...msg, textContent: "发布到不存在的栏目" });
    expect(r.reply).toContain("没找到");
    expect(handlePublishConfirm).not.toHaveBeenCalled();
  });

  it("idle + lastArticleId + 发布意图 + org 不一致 → 回'没有可发布的稿件'", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0,
      pendingPlan: null, pendingPublish: null, lastArticleId: "art1",
    });
    resolveCatalogByName.mockResolvedValue({ catalogId: 101, appId: 1, siteId: 1, name: "新闻" });
    // article 属于不同 org
    getArticleById.mockResolvedValue({ id: "art1", title: "测试文章", organizationId: "other-org", publishStatus: "approved" });

    const r = await handleInboundMessage({ ...msg, textContent: "发布到新闻" });
    expect(r.reply).toContain("没有可发布的稿件");
    expect(handlePublishConfirm).not.toHaveBeenCalled();
  });

  it("confirming + pendingPublish + '确认' 成功(ok:true) → 调 handlePublishConfirm + updateSession(idle, pendingPublish:null)", async () => {
    const pendingPublish = { articleId: "art1", articleTitle: "测试文章", catalogName: "新闻", target: { catalogId: 101, appId: 1, siteId: 1 } };
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0,
      pendingPlan: null, pendingPublish, lastArticleId: "art1",
    });

    const r = await handleInboundMessage({ ...msg, textContent: "确认" });

    expect(handlePublishConfirm).toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ status: "idle", pendingPublish: null }),
    );
    expect(r.reply).toContain("已发布");
  });

  it("confirming + pendingPublish + '确认' 失败(ok:false) → 保留 pendingPublish 可重试，不置 idle", async () => {
    const pendingPublish = { articleId: "art1", articleTitle: "测试文章", catalogName: "新闻", target: { catalogId: 101, appId: 1, siteId: 1 } };
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0,
      pendingPlan: null, pendingPublish, lastArticleId: "art1",
    });
    handlePublishConfirm.mockResolvedValue({ reply: "发布失败：boom，可稍后回复 确认 重试。", ok: false });

    const r = await handleInboundMessage({ ...msg, textContent: "确认" });

    expect(handlePublishConfirm).toHaveBeenCalled();
    // 失败：刷新窗口但不清 pendingPublish、不置 idle
    const patch = updateSession.mock.calls[0][1];
    expect(patch).not.toHaveProperty("pendingPublish");
    expect(patch.status).not.toBe("idle");
    expect(r.reply).toContain("发布失败");
  });

  it("confirming + pendingPublish + '取消' → updateSession(idle, pendingPublish:null) + 回'已取消发布'，不调 handlePublishConfirm", async () => {
    const pendingPublish = { articleId: "art1", articleTitle: "测试文章", catalogName: "新闻", target: { catalogId: 101, appId: 1, siteId: 1 } };
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0,
      pendingPlan: null, pendingPublish, lastArticleId: "art1",
    });

    const r = await handleInboundMessage({ ...msg, textContent: "取消" });

    expect(handlePublishConfirm).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ status: "idle", pendingPublish: null }),
    );
    expect(r.reply).toContain("取消");
  });
});

describe("gateway 视频/播客分支", () => {
  beforeEach(() => {
    updateSession.mockResolvedValue(undefined);
    inngestSend.mockResolvedValue(undefined);
  });

  it("配视频意图 + lastArticleId → 派 aigc/video.requested + 回'视频'", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "idle", lastArticleId: "art1", contextTurns: [], clarifyRounds: 0 });
    getArticleById.mockResolvedValue({ id: "art1", title: "AI稿", organizationId: "org1" });
    const r = await handleInboundMessage({ ...msg, textContent: "给这篇做个视频" });
    expect(inngestSend).toHaveBeenCalledWith(expect.objectContaining({
      name: "aigc/video.requested",
      id: expect.stringContaining("video:art1:"),
    }));
    expect(r.reply).toContain("视频");
  });

  it("做播客意图 + lastArticleId → 派 aigc/podcast.requested + 回'播客'", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "idle", lastArticleId: "art1", contextTurns: [], clarifyRounds: 0 });
    getArticleById.mockResolvedValue({ id: "art1", title: "AI稿", organizationId: "org1" });
    const r = await handleInboundMessage({ ...msg, textContent: "给这篇做个播客" });
    expect(inngestSend).toHaveBeenCalledWith(expect.objectContaining({
      name: "aigc/podcast.requested",
      id: expect.stringContaining("podcast:art1:"),
    }));
    expect(r.reply).toContain("播客");
  });

  it("配视频 但无 lastArticleId → 回提示不派", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "idle", lastArticleId: null, contextTurns: [], clarifyRounds: 0 });
    const r = await handleInboundMessage({ ...msg, textContent: "配视频" });
    expect(r.reply).toContain("没有可");
    expect(inngestSend).not.toHaveBeenCalled();
  });
});

describe("gateway 加配图分支", () => {
  beforeEach(() => {
    updateSession.mockResolvedValue(undefined);
    inngestSend.mockResolvedValue(undefined);
  });

  it("加配图意图 + lastArticleId → 派 aigc 事件 + 回'生成中'", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "idle", lastArticleId: "art1", contextTurns: [], clarifyRounds: 0,
    });
    getArticleById.mockResolvedValue({ id: "art1", title: "AI稿", organizationId: "org1" });

    const r = await handleInboundMessage({ ...msg, textContent: "给这篇加配图" });

    expect(inngestSend).toHaveBeenCalledWith(expect.objectContaining({
      name: "aigc/illustrate.requested",
      // 幂等键：钉钉重投同一条"加配图"不重复出图
      id: expect.stringContaining("illustrate:art1:"),
    }));
    expect(r.reply).toContain("配图");
  });

  it("加配图意图 但无 lastArticleId → 回'没有可配图的稿件'，不派事件", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "idle", lastArticleId: null, contextTurns: [], clarifyRounds: 0,
    });

    const r = await handleInboundMessage({ ...msg, textContent: "加配图" });

    expect(r.reply).toContain("没有可配图");
    expect(inngestSend).not.toHaveBeenCalled();
  });
});

describe("gateway 问候全局拦截", () => {
  beforeEach(() => {
    updateSession.mockResolvedValue(undefined);
    inngestSend.mockResolvedValue(undefined);
  });

  it("卡在 hot_list 时发「你好」→ 回友好引导 + 复位 session 到 idle", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "idle", scenarioPhase: "hot_list",
      loopContext: { topicCandidates: [] }, contextTurns: [], clarifyRounds: 0,
    });

    const r = await handleInboundMessage({ ...msg, textContent: "你好" });

    // 不再答非所问（不返回"热点还在抓取中"）
    expect(r.reply).not.toContain("热点还在抓取中");
    expect(r.reply).toContain("你好");
    // 复位卡住的阶段到 idle
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({
      scenarioPhase: "idle",
      status: "idle",
      loopContext: null,
    }));
    // 复位不得抹掉草稿：lastArticleId 不在复位 patch 里，流程可重新触发
    expect(updateSession).toHaveBeenCalledWith(
      "s1",
      expect.not.objectContaining({ lastArticleId: expect.anything() }),
    );
    // 问候不应触发任何闭环事件
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("idle 态发「你好」→ 回友好引导，不复位（无 scenarioPhase 变更）", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1", status: "idle", scenarioPhase: "idle", contextTurns: [], clarifyRounds: 0,
    });

    const r = await handleInboundMessage({ ...msg, textContent: "hi" });

    expect(r.reply).toContain("你好");
    expect(updateSession).not.toHaveBeenCalled();
  });
});
