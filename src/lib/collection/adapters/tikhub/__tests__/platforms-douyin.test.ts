import { describe, expect, it } from "vitest";
import { mapDouyinResponse } from "../platforms/douyin";
import fixture from "../__fixtures__/douyin-search.json";

describe("mapDouyinResponse", () => {
  // Cast fixture to the interface expected by mapper
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = mapDouyinResponse(fixture as any);

  it("返回 RawItem 数组（应有 ≥ 5 条）", () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
  });

  it("每个 item 都有 title + url + channel = tikhub_douyin", () => {
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.title).toBeTruthy();
      expect(item.url).toMatch(/^https?:\/\//);
      expect(item.channel).toBe("tikhub_douyin");
    }
  });

  it("contentType = short_video", () => {
    expect(items.every((i) => i.contentType === "short_video")).toBe(true);
  });

  it("attachments 含 video（第一条有 play_addr）", () => {
    const first = items[0]!;
    expect(first.attachments).toBeDefined();
    expect(first.attachments!.length).toBeGreaterThanOrEqual(1);
    const kinds = first.attachments!.map((a) => a.kind);
    expect(kinds).toContain("video");
  });

  it("publishedAt 是 Date 实例", () => {
    expect(items[0]!.publishedAt).toBeInstanceOf(Date);
  });
});
