import { describe, it, expect } from "vitest";
import { extractTopics } from "../trending-topics-renderer";

/**
 * 注：项目当前没装 @testing-library/react，vitest 跑 node 环境且只 include
 * *.test.ts。把渲染相关测试改成 extractTopics 的纯逻辑单测，
 * 覆盖 plan 列的 4 个场景（happy path / JSON 块解析 / fallback / empty）。
 * 渲染分支由 plan 验收里的人工 mission console 检查兜底。
 */
describe("TrendingTopicsRenderer.extractTopics", () => {
  it("happy path: 直接读 outputData.topics 数组", () => {
    const outputData = {
      summary: "30 条热榜",
      topics: [
        { rank: 1, platform: "微博", title: "成都串串", heat: "52.3万", url: "https://weibo.com/x" },
        { rank: 2, platform: "抖音", title: "国足备战", heat: "42.1万", url: "https://douyin.com/y" },
      ],
    };
    const topics = extractTopics(outputData);
    expect(topics).not.toBeNull();
    expect(topics?.length).toBe(2);
    expect(topics?.[0]?.title).toBe("成都串串");
    expect(topics?.[1]?.title).toBe("国足备战");
  });

  it("解析 short-circuit text 字段里的 ```json``` 块", () => {
    const outputData = {
      text: '## 调用：`trending_topics(...)`\n\n```json\n{"topics":[{"rank":1,"platform":"微博","title":"X","heat":"10万","url":"https://x"}]}\n```',
    };
    const topics = extractTopics(outputData);
    expect(topics).not.toBeNull();
    expect(topics?.length).toBe(1);
    expect(topics?.[0]?.title).toBe("X");
  });

  it("无 topics 字段也无可解析 text → null (上层走 FallbackRenderer)", () => {
    const outputData = { summary: "无法解析" };
    expect(extractTopics(outputData)).toBeNull();
  });

  it("topics 为空数组 → 返回空数组 (上层渲染 empty state，而非 null)", () => {
    const outputData = { topics: [] };
    const topics = extractTopics(outputData);
    expect(topics).not.toBeNull();
    expect(topics?.length).toBe(0);
  });

  it("非对象输入 → null", () => {
    expect(extractTopics(null)).toBeNull();
    expect(extractTopics(undefined)).toBeNull();
    expect(extractTopics("string")).toBeNull();
    expect(extractTopics(123)).toBeNull();
  });

  it("text 字段含坏 JSON 块 → null (catch 内 return)", () => {
    const outputData = {
      text: "```json\n{not valid json}\n```",
    };
    expect(extractTopics(outputData)).toBeNull();
  });

  it("text 字段 JSON 块解析成功但缺 topics 字段 → null", () => {
    const outputData = {
      text: '```json\n{"summary":"foo"}\n```',
    };
    expect(extractTopics(outputData)).toBeNull();
  });
});
