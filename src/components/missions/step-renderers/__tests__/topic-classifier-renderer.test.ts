import { describe, it, expect } from "vitest";
import { extractClassifierResults } from "../topic-classifier-renderer";

describe("extractClassifierResults", () => {
  it("happy path: 解析 outputData.results 数组", () => {
    const out = extractClassifierResults({
      results: [
        { id: "t1", category: "food", confidence: 0.95, reason: "美食", sourceUrl: "https://x.com/1" },
        { id: "t2", category: "pets", confidence: 0.88, reason: "宠物", sourceUrl: "https://x.com/2" },
        { id: "t3", category: "other", confidence: 0.3, reason: "无关", sourceUrl: "https://x.com/3" },
      ],
    });
    expect(out).not.toBeNull();
    expect(out!.passed).toHaveLength(2);
    expect(out!.other).toHaveLength(1);
    expect(out!.passed[0].category).toBe("food");
  });

  it("无 results 字段 → null", () => {
    expect(extractClassifierResults({ summary: "..." })).toBeNull();
    expect(extractClassifierResults(null)).toBeNull();
    expect(extractClassifierResults("string")).toBeNull();
  });

  it("results 都是 other → passed 为空 / other 全部", () => {
    const out = extractClassifierResults({
      results: [
        { id: "t1", category: "other", confidence: 0, reason: "", sourceUrl: "" },
      ],
    });
    expect(out!.passed).toHaveLength(0);
    expect(out!.other).toHaveLength(1);
  });

  it("空 results 数组 → 都为空", () => {
    const out = extractClassifierResults({ results: [] });
    expect(out!.passed).toHaveLength(0);
    expect(out!.other).toHaveLength(0);
  });

  it("results 不是数组 → null", () => {
    expect(extractClassifierResults({ results: "not array" })).toBeNull();
  });
});
