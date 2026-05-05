import { describe, expect, it } from "vitest";
import { mapWechatChannelsResponse } from "../platforms/wechat-channels";
import fixture from "../__fixtures__/wechat-channels-search.json";

describe("mapWechatChannelsResponse", () => {
  const items = mapWechatChannelsResponse(fixture);

  it("返回 RawItem 数组（应有 ≥ 5 条）", () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("每个 item 都有 title + channel = tikhub_wechat_channels", () => {
    for (const item of items) {
      expect(item.title).toBeTruthy();
      expect(item.channel).toBe("tikhub_wechat_channels");
    }
  });

  it("contentType = short_video", () => {
    expect(items.every((i) => i.contentType === "short_video")).toBe(true);
  });

  it("attachments 含 video 或 thumbnail", () => {
    const first = items[0]!;
    expect(first.attachments?.length).toBeGreaterThanOrEqual(1);
    const kinds = first.attachments!.map((a) => a.kind);
    expect(kinds.some((k) => ["video", "thumbnail"].includes(k))).toBe(true);
  });

  it("publishedAt 是 Date 实例", () => {
    expect(items[0]!.publishedAt).toBeInstanceOf(Date);
  });
});
