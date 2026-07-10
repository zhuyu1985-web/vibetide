import { describe, it, expect } from "vitest";
import { CHANNEL_PRESETS, planToGenerateParams, defaultPlanForChannel } from "../creation-plan";

describe("渠道适配", () => {
  it("小红书默认短、口语", () => {
    const p = defaultPlanForChannel("xiaohongshu");
    expect(p.wordCount).toBeLessThanOrEqual(600);
    expect(p.genre).toBe("xiaohongshu");
  });
  it("planToGenerateParams 注入字数与渠道风格提示到 outline", () => {
    const params = planToGenerateParams({
      topic: { title: "某热点" }, topicOptions: [], topicFromHotlist: true,
      angle: "深度解读", genre: "news", channel: "wechat_mp", wordCount: 1000,
      illustrate: false, hotlistAvailable: true,
    });
    expect(params.outline).toContain("某热点");
    expect(params.outline).toContain("深度解读");
    expect(params.outline).toContain("1000");
    expect(params.maxLength).toBeGreaterThanOrEqual(1000);
    expect(typeof params.style).toBe("string");
  });
});
