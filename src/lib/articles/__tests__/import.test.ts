import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchViaJinaReader } = vi.hoisted(() => ({ fetchViaJinaReader: vi.fn() }));
vi.mock("@/lib/web-fetch", () => ({ fetchViaJinaReader }));

const { findFirst, insertValues, insertReturning } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  insertValues: vi.fn(),
  insertReturning: vi.fn(),
}));
vi.mock("@/db", () => ({
  db: {
    query: { articles: { findFirst } },
    insert: () => ({
      values: (v: unknown) => {
        insertValues(v);
        return { returning: () => insertReturning() };
      },
    }),
  },
}));

import { fetchAndClassifyUrl, ingestArticleFromUrl } from "../import";

beforeEach(() => {
  fetchViaJinaReader.mockReset();
  findFirst.mockReset();
  insertValues.mockReset();
  insertReturning.mockReset();
});

describe("fetchAndClassifyUrl", () => {
  it("抓取正文 + 标题，P1 一律 mediaType=article", async () => {
    fetchViaJinaReader.mockResolvedValue({ title: "测试标题", content: "正文内容" });
    const r = await fetchAndClassifyUrl("https://news.example.com/x");
    expect(r.title).toBe("测试标题");
    expect(r.body).toBe("正文内容");
    expect(r.mediaType).toBe("article");
  });

  it("标题为空 → 回退 hostname", async () => {
    fetchViaJinaReader.mockResolvedValue({ title: "   ", content: "正文" });
    const r = await fetchAndClassifyUrl("https://news.example.com/x");
    expect(r.title).toBe("news.example.com");
  });
});

describe("ingestArticleFromUrl", () => {
  it("去重命中 → skipped:true，不插入", async () => {
    findFirst.mockResolvedValue({ id: "a-old", title: "旧稿", mediaType: "article" });
    const r = await ingestArticleFromUrl({
      organizationId: "org1",
      url: "https://x/y",
      sourceName: "对话导入·u",
    });
    expect(r.skipped).toBe(true);
    expect(r.articleId).toBe("a-old");
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("新稿 → repost/draft 入库 + importedFrom + aiAnalysisStatus=processing", async () => {
    findFirst.mockResolvedValue(undefined);
    insertReturning.mockResolvedValue([{ id: "a-new" }]);
    fetchViaJinaReader.mockResolvedValue({ title: "标题", content: "正文正文" });
    const r = await ingestArticleFromUrl({
      organizationId: "org1",
      url: "https://x/y",
      sourceName: "对话导入·u",
      importedFrom: { channel: "cowork", conversationId: "c1", userId: "u1" },
    });
    expect(r.skipped).toBe(false);
    expect(r.articleId).toBe("a-new");
    expect(r.mediaType).toBe("article");
    const v = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(v.sourceType).toBe("repost");
    expect(v.status).toBe("draft");
    expect(v.aiAnalysisStatus).toBe("processing");
    expect(v.wordCount).toBe("正文正文".length);
    expect((v.metadata as { importedFrom?: unknown }).importedFrom).toEqual({
      channel: "cowork",
      conversationId: "c1",
      userId: "u1",
    });
  });

  it("传入已分类内容则复用，不二次抓取", async () => {
    findFirst.mockResolvedValue(undefined);
    insertReturning.mockResolvedValue([{ id: "a2" }]);
    await ingestArticleFromUrl({
      organizationId: "org1",
      url: "https://x/z",
      sourceName: "对话导入·u",
      classified: { title: "已抓标题", body: "已抓正文", mediaType: "video", videoSourceHint: "https://x/v.mp4" },
    });
    expect(fetchViaJinaReader).not.toHaveBeenCalled();
    const v = insertValues.mock.calls[0][0] as Record<string, unknown>;
    expect(v.mediaType).toBe("video");
  });
});
