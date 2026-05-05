import { describe, expect, it } from "vitest";
import { mapZhihuResponse } from "../platforms/zhihu";
import fixture from "../__fixtures__/zhihu-search.json";

describe("mapZhihuResponse", () => {
  const items = mapZhihuResponse(fixture);

  it("返回 RawItem 数组（应有 ≥ 5 条）", () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("每个 item 都有 title + channel = tikhub_zhihu", () => {
    for (const item of items) {
      expect(item.title).toBeTruthy();
      expect(item.channel).toBe("tikhub_zhihu");
    }
  });

  it("contentType = image_text", () => {
    expect(items.every((i) => i.contentType === "image_text")).toBe(true);
  });

  it("attachments 为空数组", () => {
    for (const item of items) {
      expect(item.attachments).toEqual([]);
    }
  });

  it("publishedAt 是 Date 实例", () => {
    expect(items[0]!.publishedAt).toBeInstanceOf(Date);
  });
});
