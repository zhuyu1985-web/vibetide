import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindFirst,
  mockInsert,
  mockValues,
  kieGenerateDialogue,
  KieConfigError,
  storeRemoteMediaToTos,
  getChannelConfig,
  sendChannelMessage,
  generateText,
  getLanguageModel,
  getDefaultModel,
} = vi.hoisted(() => {
  // db chain mocks
  const mockValues = vi.fn();
  const mockFindFirst = vi.fn();
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  class KieConfigError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "KieConfigError";
    }
  }

  return {
    mockFindFirst,
    mockInsert,
    mockValues,
    kieGenerateDialogue: vi.fn(),
    KieConfigError,
    storeRemoteMediaToTos: vi.fn(),
    getChannelConfig: vi.fn(),
    sendChannelMessage: vi.fn(),
    generateText: vi.fn(),
    getLanguageModel: vi.fn().mockReturnValue("mock-model"),
    getDefaultModel: vi.fn().mockReturnValue("deepseek-chat"),
  };
});

vi.mock("@/db", () => ({
  db: {
    query: { articles: { findFirst: mockFindFirst } },
    insert: mockInsert,
  },
}));
vi.mock("@/db/schema", () => ({
  articles: {},
  articleAssets: {},
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args) => args),
  eq: vi.fn((col, val) => ({ col, val })),
}));
vi.mock("@/lib/aigc/kie-client", () => ({ kieGenerateDialogue, KieConfigError }));
vi.mock("@/lib/aigc/store-media", () => ({ storeRemoteMediaToTos }));
vi.mock("@/lib/dal/channels", () => ({ getChannelConfig }));
vi.mock("@/lib/channels/outbound", () => ({ sendChannelMessage }));
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel, getDefaultModel }));
vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: (_opts: unknown, _trigger: unknown, handler: unknown) => handler,
  },
}));

import { buildDialogueScript, runPodcast } from "../aigc-podcast";

const baseData = {
  organizationId: "org1",
  articleId: "art1",
  channelCtx: {
    organizationId: "org1",
    configId: "cfg1",
    platform: "dingtalk" as const,
    chatId: "chat1",
    externalUserId: "user1",
  },
};

const mockConfig = {
  id: "cfg1",
  organizationId: "org1",
  platform: "dingtalk",
  name: "测试渠道",
  appKey: "https://webhook.example.com",
  appSecret: null,
  robotSecret: null,
  inboundSecret: null,
  clientId: null,
  agentId: null,
  token: null,
  encodingAesKey: null,
  isEnabled: true,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  getChannelConfig.mockResolvedValue(mockConfig);
  sendChannelMessage.mockResolvedValue({ success: true });
});

// ─────────────────────────────────────────────────────────────
// buildDialogueScript 单元测试
// ─────────────────────────────────────────────────────────────

describe("buildDialogueScript", () => {
  it("generateText 返回合法 JSON 数组 → 解析并规范化 speaker A/B", async () => {
    generateText.mockResolvedValue({
      text: JSON.stringify([
        { speaker: "A", text: "欢迎来到今天的播客。" },
        { speaker: "B", text: "今天我们聊一聊人工智能。" },
        { speaker: "a", text: "没错，AI 改变了世界。" },  // 小写 a → 应规范为 A
      ]),
    });

    const result = await buildDialogueScript({ title: "AI 时代", summary: "AI 摘要" });

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ speaker: "A", text: "欢迎来到今天的播客。" });
    expect(result[1]).toEqual({ speaker: "B", text: "今天我们聊一聊人工智能。" });
    expect(result[2]).toEqual({ speaker: "A", text: "没错，AI 改变了世界。" }); // 小写 a → A
  });

  it("generateText 返回带 ```json 代码围栏 → 剥离后正常解析", async () => {
    generateText.mockResolvedValue({
      text: "```json\n[{\"speaker\":\"A\",\"text\":\"开场白\"},{\"speaker\":\"B\",\"text\":\"回应\"}]\n```",
    });

    const result = await buildDialogueScript({ title: "测试标题" });

    expect(result).toHaveLength(2);
    expect(result[0].speaker).toBe("A");
    expect(result[1].speaker).toBe("B");
  });

  it("generateText 返回非 JSON 垃圾 → fallback [{speaker:A, text:summary}]", async () => {
    generateText.mockResolvedValue({ text: "这不是 JSON，这是乱码！！！" });

    const result = await buildDialogueScript({ title: "标题", summary: "文章摘要" });

    expect(result).toEqual([{ speaker: "A", text: "文章摘要" }]);
  });

  it("generateText 返回空数组 → fallback [{speaker:A, text:summary}]", async () => {
    generateText.mockResolvedValue({ text: "[]" });

    const result = await buildDialogueScript({ title: "标题", summary: "文章摘要" });

    expect(result).toEqual([{ speaker: "A", text: "文章摘要" }]);
  });

  it("generateText 抛错 → fallback [{speaker:A, text:title}]（无 summary 时）", async () => {
    generateText.mockRejectedValue(new Error("LLM 超时"));

    const result = await buildDialogueScript({ title: "兜底标题" });

    expect(result).toEqual([{ speaker: "A", text: "兜底标题" }]);
  });
});

// ─────────────────────────────────────────────────────────────
// runPodcast 集成测试
// ─────────────────────────────────────────────────────────────

describe("runPodcast — 成功路径", () => {
  it("成功：voiceA/B 正确映射 + storeRemoteMediaToTos mediaType:audio + usageType:audio + 回执含 publicUrl", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "测试文章",
      summary: "文章摘要",
      body: "正文内容",
      organizationId: "org1",
    });
    generateText.mockResolvedValue({
      text: JSON.stringify([
        { speaker: "A", text: "主持人 A 开场。" },
        { speaker: "B", text: "主持人 B 回应。" },
      ]),
    });
    kieGenerateDialogue.mockResolvedValue(["https://kie.example.com/podcast.mp3"]);
    storeRemoteMediaToTos.mockResolvedValue({
      assetId: "asset1",
      publicUrl: "https://tos.example.com/aigc/org1/art1/uuid.mp3",
    });

    await runPodcast(baseData);

    // voiceA/B 映射正确
    const dialogueArg = kieGenerateDialogue.mock.calls[0][0].dialogue as { text: string; voice: string }[];
    const defaultVoiceA = "EkK5I93UQWFDigLMpZcX";
    const defaultVoiceB = "Z3R5wn05IrDiVCyEkUrK";
    expect(dialogueArg[0]).toEqual({ text: "主持人 A 开场。", voice: defaultVoiceA });
    expect(dialogueArg[1]).toEqual({ text: "主持人 B 回应。", voice: defaultVoiceB });

    // storeRemoteMediaToTos 以 audio 类型调用
    expect(storeRemoteMediaToTos).toHaveBeenCalledWith(
      "https://kie.example.com/podcast.mp3",
      expect.objectContaining({ organizationId: "org1", articleId: "art1", mediaType: "audio" })
    );

    // db.insert 写 usageType:"audio"
    expect(mockInsert).toHaveBeenCalled();
    const insertValues = mockInsert.mock.results[0].value.values.mock.calls[0][0] as Record<string, unknown>;
    expect(insertValues).toMatchObject({ articleId: "art1", assetId: "asset1", usageType: "audio" });

    // 回执含 publicUrl
    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("https://tos.example.com/aigc/org1/art1/uuid.mp3");
  });
});

describe("runPodcast — 错误路径", () => {
  it("article 不存在 → 回执调用，不调 kieGenerateDialogue", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await runPodcast(baseData);

    expect(kieGenerateDialogue).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("找不到");
  });

  it("kieGenerateDialogue 抛普通 Error → 回执含'失败'", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "错误测试",
      summary: null,
      body: null,
      organizationId: "org1",
    });
    generateText.mockResolvedValue({
      text: JSON.stringify([{ speaker: "A", text: "测试内容" }]),
    });
    kieGenerateDialogue.mockRejectedValue(new Error("kie 对话合成失败：quota exceeded"));

    await runPodcast(baseData);

    expect(mockInsert).not.toHaveBeenCalled();
    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("失败");
    expect(replyContent).toContain("kie 对话合成失败");
  });

  it("kieGenerateDialogue 抛 KieConfigError → 回执含'未配置'", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "配置测试",
      summary: null,
      body: null,
      organizationId: "org1",
    });
    generateText.mockResolvedValue({
      text: JSON.stringify([{ speaker: "A", text: "测试内容" }]),
    });
    kieGenerateDialogue.mockRejectedValue(new KieConfigError("KIE_API_KEY 未配置"));

    await runPodcast(baseData);

    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("未配置");
  });
});
