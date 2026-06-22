import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindFirst,
  mockInsert,
  kieGenerateVideo,
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
    kieGenerateVideo: vi.fn(),
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
vi.mock("@/lib/aigc/kie-client", () => ({ kieGenerateVideo, KieConfigError }));
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

import { runVideo } from "../aigc-video";

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
  generateText.mockResolvedValue({ text: "a cinematic aerial shot with dramatic lighting" });
});

describe("runVideo — 成功路径", () => {
  it("成功：storeRemoteMediaToTos mediaType:video + article_assets usageType:video + 回执含 publicUrl", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "测试文章",
      summary: "文章摘要",
      organizationId: "org1",
    });
    kieGenerateVideo.mockResolvedValue(["https://kie.example.com/video.mp4"]);
    storeRemoteMediaToTos.mockResolvedValue({
      assetId: "asset1",
      publicUrl: "https://tos.example.com/aigc/org1/art1/uuid.mp4",
    });

    await runVideo(baseData);

    expect(storeRemoteMediaToTos).toHaveBeenCalledWith(
      "https://kie.example.com/video.mp4",
      expect.objectContaining({ organizationId: "org1", articleId: "art1", mediaType: "video" })
    );
    expect(mockInsert).toHaveBeenCalled();
    // Verify usageType is "video" and coverImageUrl is NOT written
    const insertValues = mockInsert.mock.results[0].value.values.mock.calls[0][0] as Record<string, unknown>;
    expect(insertValues).toMatchObject({ articleId: "art1", assetId: "asset1", usageType: "video" });
    expect(insertValues).not.toHaveProperty("coverImageUrl");

    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("https://tos.example.com/aigc/org1/art1/uuid.mp4");
  });

  it("generateText 失败时，兜底用文章 title 作 prompt", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "兜底标题",
      summary: null,
      organizationId: "org1",
    });
    generateText.mockRejectedValue(new Error("LLM 超时"));
    kieGenerateVideo.mockResolvedValue(["https://kie.example.com/video2.mp4"]);
    storeRemoteMediaToTos.mockResolvedValue({
      assetId: "asset2",
      publicUrl: "https://tos.example.com/video2.mp4",
    });

    await runVideo(baseData);

    expect(kieGenerateVideo).toHaveBeenCalledWith({ prompt: "兜底标题" });
    expect(mockInsert).toHaveBeenCalled();
  });
});

describe("runVideo — 错误路径", () => {
  it("article 不存在 → 回执含'找不到'，不调 kieGenerateVideo", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await runVideo(baseData);

    expect(kieGenerateVideo).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("找不到");
  });

  it("kieGenerateVideo 抛普通 Error → 回执含'失败'", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "错误测试",
      summary: null,
      organizationId: "org1",
    });
    kieGenerateVideo.mockRejectedValue(new Error("kie 生成失败：quota exceeded"));

    await runVideo(baseData);

    expect(mockInsert).not.toHaveBeenCalledWith(expect.objectContaining({ values: expect.anything() }));
    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("失败");
    expect(replyContent).toContain("kie 生成失败");
  });

  it("kieGenerateVideo 抛 KieConfigError → 回执含'未配置'", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "配置测试",
      summary: null,
      organizationId: "org1",
    });
    kieGenerateVideo.mockRejectedValue(new KieConfigError("KIE_API_KEY 未配置"));

    await runVideo(baseData);

    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("未配置");
  });
});
