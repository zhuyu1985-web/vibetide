import { describe, expect, it } from "vitest";
import { mapWeiboResponse } from "../platforms/weibo";
import fixture from "../__fixtures__/weibo-search.json";

describe("mapWeiboResponse", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = mapWeiboResponse(fixture as any);

  it("返回 RawItem 数组（≥ 3 条）", () => {
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it("channel = tikhub_weibo", () => {
    for (const item of items) {
      expect(item.channel).toBe("tikhub_weibo");
    }
  });

  it("contentType 按内容类型正确分布（至少含 image_text / image_set / video 之一）", () => {
    const types = items.map((i) => i.contentType);
    const validTypes = new Set(["image_text", "image_set", "video"]);
    expect(types.some((t) => t !== undefined && validTypes.has(t))).toBe(true);
  });

  it("publishedAt 是 Date 实例（已解析 Twitter 格式 created_at）", () => {
    // 所有 item 都应有 publishedAt
    for (const item of items) {
      expect(item.publishedAt).toBeInstanceOf(Date);
    }
  });

  it("视频条目有 video 附件", () => {
    const videoItems = items.filter((i) => i.contentType === "video");
    // fixture 含 3 个视频条目
    expect(videoItems.length).toBeGreaterThanOrEqual(1);
    for (const vi of videoItems) {
      const kinds = vi.attachments?.map((a) => a.kind) ?? [];
      expect(kinds).toContain("video");
    }
  });

  it("图集条目有多个 image 附件", () => {
    const imageSetItems = items.filter((i) => i.contentType === "image_set");
    expect(imageSetItems.length).toBeGreaterThanOrEqual(1);
    for (const si of imageSetItems) {
      const imageAttachments = si.attachments?.filter((a) => a.kind === "image") ?? [];
      expect(imageAttachments.length).toBeGreaterThan(1);
    }
  });

  it("每个 item 的 url 符合 weibo.com 或 http 格式", () => {
    for (const item of items) {
      expect(item.url).toMatch(/^https?:\/\//);
    }
  });

  it("rawMetadata 含 platform = weibo", () => {
    for (const item of items) {
      expect(item.rawMetadata?.platform).toBe("weibo");
    }
  });
});
