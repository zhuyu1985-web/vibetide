import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());
const returning = vi.hoisted(() => vi.fn());
const values = vi.hoisted(() => vi.fn(() => ({ returning })));
const insert = vi.hoisted(() => vi.fn(() => ({ values })));

vi.mock("@/db", () => ({
  db: { query: { articles: { findFirst } }, insert },
}));

const fetchViaJinaReader = vi.hoisted(() => vi.fn());
vi.mock("@/lib/web-fetch", () => ({ fetchViaJinaReader }));

import { ingestLinkToArticle } from "../ingest-link-to-article";

const baseInput = {
  organizationId: "org1",
  url: "https://example.com/a",
  sourceName: "钉钉收稿·@u1",
  channelContext: {
    platform: "dingtalk",
    configId: "cfg1",
    chatId: "chat1",
    externalUserId: "u1",
    externalMessageId: "m1",
  },
};

beforeEach(() => {
  findFirst.mockReset();
  returning.mockReset();
  values.mockClear();
  insert.mockClear();
  fetchViaJinaReader.mockReset();
});

describe("ingestLinkToArticle", () => {
  it("已存在同 org+sourceUrl → 跳过，不抓取不插入", async () => {
    findFirst.mockResolvedValue({ id: "old1", title: "旧稿" });
    const r = await ingestLinkToArticle(baseInput);
    expect(r).toEqual({ skipped: true, articleId: "old1", title: "旧稿" });
    expect(fetchViaJinaReader).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("新链接 → 抓取并插入 draft，字段映射正确", async () => {
    findFirst.mockResolvedValue(undefined);
    fetchViaJinaReader.mockResolvedValue({ title: "标题", content: "正文内容" });
    returning.mockResolvedValue([{ id: "new1" }]);
    const r = await ingestLinkToArticle(baseInput);
    expect(r).toEqual({ skipped: false, articleId: "new1", title: "标题" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = (values.mock.calls as any)[0][0];
    expect(inserted).toMatchObject({
      organizationId: "org1",
      title: "标题",
      body: "正文内容",
      status: "draft",
      sourceType: "repost",
      sourceUrl: "https://example.com/a",
      sourceName: "钉钉收稿·@u1",
      createdBy: null,
    });
    expect(inserted.content).toEqual({ headline: "标题", body: "正文内容", imageNotes: [] });
    expect(inserted.metadata.ingestedFromChannel.configId).toBe("cfg1");
  });

  it("抓取标题为空 → 用域名兜底", async () => {
    findFirst.mockResolvedValue(undefined);
    fetchViaJinaReader.mockResolvedValue({ title: "  ", content: "x" });
    returning.mockResolvedValue([{ id: "new2" }]);
    const r = await ingestLinkToArticle(baseInput);
    expect(r.title).toBe("example.com");
  });
});
