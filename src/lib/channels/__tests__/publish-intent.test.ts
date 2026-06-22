import { describe, it, expect } from "vitest";
import { isPublishIntent, extractPublishTarget } from "../publish-intent";

describe("isPublishIntent", () => {
  it("命中发布类", () => {
    ["把这篇发布到新闻", "发布到体育频道", "发到要闻", "推送到民生", "把它发布到首页"].forEach(t =>
      expect(isPublishIntent(t)).toBe(true));
  });
  it("不命中普通写稿/检索/闲聊", () => {
    ["写一篇AI稿", "抓今天的科技热点", "换个财经角度", "你好"].forEach(t =>
      expect(isPublishIntent(t)).toBe(false));
  });
});

describe("extractPublishTarget", () => {
  it("提取栏目名", () => {
    expect(extractPublishTarget("把这篇发布到新闻")).toBe("新闻");
    expect(extractPublishTarget("发布到体育频道")).toBe("体育频道");
    expect(extractPublishTarget("发到要闻栏目")).toBe("要闻");
  });
  it("无明确目标 → null", () => {
    expect(extractPublishTarget("把这篇发布了")).toBeNull();
    expect(extractPublishTarget("发布")).toBeNull();
  });
});
