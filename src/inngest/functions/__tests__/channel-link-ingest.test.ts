import { describe, it, expect, vi, beforeEach } from "vitest";

const { ingestLinkToArticle, postToSessionWebhook, recordOutboundMessage } = vi.hoisted(() => ({
  ingestLinkToArticle: vi.fn(),
  postToSessionWebhook: vi.fn(),
  recordOutboundMessage: vi.fn(),
}));
vi.mock("@/lib/channels/ingest-link-to-article", () => ({ ingestLinkToArticle }));
vi.mock("@/lib/channels/session-webhook", () => ({ postToSessionWebhook }));
vi.mock("@/app/actions/channels", () => ({ recordOutboundMessage }));

import { runIngestAndReply, notifyIngestFailure } from "../channel-link-ingest";

const data = {
  organizationId: "org1",
  configId: "cfg1",
  platform: "dingtalk" as const,
  url: "https://example.com/a",
  sourceName: "钉钉收稿·@u1",
  chatId: "c1",
  externalUserId: "u1",
  externalMessageId: "m1",
  replyWebhook: "https://oapi/session",
};

beforeEach(() => {
  ingestLinkToArticle.mockReset();
  postToSessionWebhook.mockReset();
  recordOutboundMessage.mockReset();
});

describe("runIngestAndReply", () => {
  it("新稿入库 → 回执 ✅ 含查看链接", async () => {
    ingestLinkToArticle.mockResolvedValue({ skipped: false, articleId: "a1", title: "标题" });
    postToSessionWebhook.mockResolvedValue({ ok: true });
    await runIngestAndReply(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [, payload] = postToSessionWebhook.mock.calls[0] as any;
    expect(payload.content).toContain("✅ 已收录");
    expect(payload.content).toContain("标题");
  });

  it("命中去重 → 回执已收录过", async () => {
    ingestLinkToArticle.mockResolvedValue({ skipped: true, articleId: "a1", title: "旧稿" });
    postToSessionWebhook.mockResolvedValue({ ok: true });
    await runIngestAndReply(data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [, payload] = postToSessionWebhook.mock.calls[0] as any;
    expect(payload.content).toContain("已收录过");
  });

  it("无 replyWebhook → 不调 sessionWebhook", async () => {
    ingestLinkToArticle.mockResolvedValue({ skipped: false, articleId: "a1", title: "t" });
    await runIngestAndReply({ ...data, replyWebhook: "" });
    expect(postToSessionWebhook).not.toHaveBeenCalled();
  });
});

describe("notifyIngestFailure", () => {
  it("有 replyWebhook → 推 ❌ 失败回执 + 记 failed 日志", async () => {
    postToSessionWebhook.mockResolvedValue({ ok: true });
    recordOutboundMessage.mockResolvedValue({ messageId: "msg1" });
    await notifyIngestFailure(data, "抓取超时");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [, payload] = postToSessionWebhook.mock.calls[0] as any;
    expect(payload.content).toContain("❌ 抓取失败");
    expect(payload.content).toContain("抓取超时");
    expect(recordOutboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org1", configId: "cfg1", status: "failed" })
    );
  });
});
