import { describe, expect, it } from "vitest";
import { mapXiaohongshuResponse } from "../platforms/xiaohongshu";
import fixture from "../__fixtures__/xiaohongshu-search.json";

describe("mapXiaohongshuResponse", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = mapXiaohongshuResponse(fixture as any);

  it("返回 RawItem 数组（≥ 5 条，过滤广告/dsl 条目）", () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("channel = tikhub_xiaohongshu", () => {
    for (const item of items) {
      expect(item.channel).toBe("tikhub_xiaohongshu");
    }
  });

  it("contentType 按笔记类型正确区分（video 或 image_set）", () => {
    const validTypes = new Set(["video", "image_set"]);
    for (const item of items) {
      expect(validTypes.has(item.contentType as string)).toBe(true);
    }
    // fixture 含 video 和 normal 两种类型
    const types = items.map((i) => i.contentType);
    expect(types).toContain("video");
    expect(types).toContain("image_set");
  });

  it("视频笔记有 video 附件（master_url）", () => {
    const videoItems = items.filter((i) => i.contentType === "video");
    expect(videoItems.length).toBeGreaterThanOrEqual(1);
    for (const vi of videoItems) {
      const kinds = vi.attachments?.map((a) => a.kind) ?? [];
      expect(kinds).toContain("video");
      const videoAttach = vi.attachments?.find((a) => a.kind === "video");
      expect(videoAttach?.url).toMatch(/^https?:\/\//);
    }
  });

  it("图文笔记（normal）有 image_set contentType 和 image 附件", () => {
    const imageSetItems = items.filter((i) => i.contentType === "image_set");
    expect(imageSetItems.length).toBeGreaterThanOrEqual(1);
    for (const si of imageSetItems) {
      const imageAttachments = si.attachments?.filter((a) => a.kind === "image") ?? [];
      expect(imageAttachments.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("publishedAt 是 Date 实例", () => {
    for (const item of items) {
      expect(item.publishedAt).toBeInstanceOf(Date);
    }
  });

  it("每个 item 的 url 指向 xiaohongshu.com", () => {
    for (const item of items) {
      expect(item.url).toMatch(/xiaohongshu\.com/);
    }
  });

  it("rawMetadata 含 platform = xiaohongshu 及 note_id", () => {
    for (const item of items) {
      expect(item.rawMetadata?.platform).toBe("xiaohongshu");
      expect(item.rawMetadata?.note_id).toBeTruthy();
    }
  });
});
