import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockFindFirst,
  mockUpdate,
  mockInsert,
  kieGenerateImage,
  KieConfigError,
  storeRemoteImageToTos,
  getChannelConfig,
  sendChannelMessage,
  generateText,
  getLanguageModel,
  getDefaultModel,
} = vi.hoisted(() => {
  // db chain mocks
  const mockWhere = vi.fn();
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockValues = vi.fn();
  const mockFindFirst = vi.fn();
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  class KieConfigError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "KieConfigError";
    }
  }

  return {
    mockFindFirst,
    mockUpdate,
    mockInsert,
    mockSet,
    mockWhere,
    mockValues,
    kieGenerateImage: vi.fn(),
    KieConfigError,
    storeRemoteImageToTos: vi.fn(),
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
    update: mockUpdate,
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
vi.mock("@/lib/aigc/kie-client", () => ({ kieGenerateImage, KieConfigError }));
vi.mock("@/lib/aigc/store-image", () => ({ storeRemoteImageToTos }));
vi.mock("@/lib/dal/channels", () => ({ getChannelConfig }));
vi.mock("@/lib/channels/outbound", () => ({ sendChannelMessage }));
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel, getDefaultModel }));
vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: (_opts: unknown, _trigger: unknown, handler: unknown) => handler,
  },
}));

import { runIllustrate } from "../aigc-illustrate";

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
  generateText.mockResolvedValue({ text: "a beautiful landscape with mountains" });
});

describe("runIllustrate — 成功路径", () => {
  it("成功：db.update coverImageUrl + 回执含 publicUrl", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "测试文章",
      summary: "文章摘要",
      organizationId: "org1",
    });
    kieGenerateImage.mockResolvedValue(["https://kie.example.com/image.png"]);
    storeRemoteImageToTos.mockResolvedValue({
      assetId: "asset1",
      publicUrl: "https://tos.example.com/aigc/org1/art1/uuid.png",
    });

    await runIllustrate(baseData);

    expect(mockUpdate).toHaveBeenCalled();
    expect(storeRemoteImageToTos).toHaveBeenCalledWith(
      "https://kie.example.com/image.png",
      expect.objectContaining({ organizationId: "org1", articleId: "art1" })
    );
    expect(mockInsert).toHaveBeenCalled();

    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("✅ 配图已加到");
    expect(replyContent).toContain("https://tos.example.com/aigc/org1/art1/uuid.png");
  });

  it("带 userHint：kieGenerateImage 调用前产 prompt + 写回 cover", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "科技新闻",
      summary: null,
      organizationId: "org1",
    });
    kieGenerateImage.mockResolvedValue(["https://kie.example.com/img2.png"]);
    storeRemoteImageToTos.mockResolvedValue({
      assetId: "asset2",
      publicUrl: "https://tos.example.com/img2.png",
    });

    await runIllustrate({ ...baseData, userHint: "科幻风格" });

    expect(generateText).toHaveBeenCalled();
    const promptArg = generateText.mock.calls[0][0].prompt as string;
    expect(promptArg).toContain("科技新闻");
    expect(promptArg).toContain("科幻风格");
    expect(kieGenerateImage).toHaveBeenCalledWith({
      prompt: "a beautiful landscape with mountains",
    });
  });

  it("generateText 失败时，兜底用文章 title 作 prompt", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "兜底标题",
      summary: null,
      organizationId: "org1",
    });
    generateText.mockRejectedValue(new Error("LLM 超时"));
    kieGenerateImage.mockResolvedValue(["https://kie.example.com/img3.png"]);
    storeRemoteImageToTos.mockResolvedValue({
      assetId: "asset3",
      publicUrl: "https://tos.example.com/img3.png",
    });

    await runIllustrate(baseData);

    expect(kieGenerateImage).toHaveBeenCalledWith({ prompt: "兜底标题" });
    expect(mockUpdate).toHaveBeenCalled();
  });
});

describe("runIllustrate — 错误路径", () => {
  it("article 不存在 → 回执'找不到稿件'，不调 kieGenerateImage", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    await runIllustrate(baseData);

    expect(kieGenerateImage).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("找不到稿件");
  });

  it("kieGenerateImage 抛普通 Error → 回执含'失败'", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "错误测试",
      summary: null,
      organizationId: "org1",
    });
    kieGenerateImage.mockRejectedValue(new Error("kie 生成失败：quota exceeded"));

    await runIllustrate(baseData);

    expect(mockUpdate).not.toHaveBeenCalled();
    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("配图失败");
    expect(replyContent).toContain("kie 生成失败");
  });

  it("kieGenerateImage 抛 KieConfigError → 回执'未配置'", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "配置测试",
      summary: null,
      organizationId: "org1",
    });
    kieGenerateImage.mockRejectedValue(new KieConfigError("KIE_API_KEY 未配置"));

    await runIllustrate(baseData);

    expect(mockUpdate).not.toHaveBeenCalled();
    const replyContent = sendChannelMessage.mock.calls[0][0].content as string;
    expect(replyContent).toContain("配图功能未配置");
  });

  it("getChannelConfig 返回 null → 不调 sendChannelMessage", async () => {
    mockFindFirst.mockResolvedValue(undefined);
    getChannelConfig.mockResolvedValue(null);

    await runIllustrate(baseData);

    expect(sendChannelMessage).not.toHaveBeenCalled();
  });
});

describe("runIllustrate — 无渠道上下文（cowork PC）", () => {
  it("缺省 channelCtx：仍写回 cover，但跳过 IM 回执（不查 config、不发消息）", async () => {
    mockFindFirst.mockResolvedValue({
      id: "art1",
      title: "PC 出稿标题",
      summary: "摘要",
      organizationId: "org1",
    });
    kieGenerateImage.mockResolvedValue(["https://kie.example.com/cowork.png"]);
    storeRemoteImageToTos.mockResolvedValue({
      assetId: "asset9",
      publicUrl: "https://tos.example.com/cowork.png",
    });

    // 注意：不带 channelCtx
    await runIllustrate({ organizationId: "org1", articleId: "art1" });

    // 封面仍写回
    expect(kieGenerateImage).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
    // 无渠道 → 不查 config、不发 IM 回执
    expect(getChannelConfig).not.toHaveBeenCalled();
    expect(sendChannelMessage).not.toHaveBeenCalled();
  });
});
