import { describe, expect, it } from "vitest";
import { matchTopicsForItem, type TopicWithKeywords } from "../topic-matcher";

const topics: TopicWithKeywords[] = [
  { id: "t1", name: "美丽中国", primaryKeywords: ["美丽中国"], otherKeywords: ["美丽中国建设", "生态宜居"] },
  { id: "t2", name: "长江生态", primaryKeywords: ["长江生态"], otherKeywords: ["长江保护", "长江流域"] },
  { id: "t3", name: "双碳", primaryKeywords: ["双碳"], otherKeywords: ["碳达峰", "碳中和"] },
];

describe("matchTopicsForItem", () => {
  it("主词命中（精确）", () => {
    const r = matchTopicsForItem("今天讨论美丽中国的进展", topics);
    expect(r.length).toBe(1);
    expect(r[0]!.topicId).toBe("t1");
    expect(r[0]!.matchType).toBe("keyword");
    expect(r[0]!.matchedKeyword).toBe("美丽中国");
  });

  it("近似词命中（matchType 仍 keyword，matchedKeyword 是具体词）", () => {
    const r = matchTopicsForItem("乡村振兴关注生态宜居", topics);
    expect(r.length).toBe(1);
    expect(r[0]!.topicId).toBe("t1");
    expect(r[0]!.matchType).toBe("keyword");
    expect(r[0]!.matchedKeyword).toBe("生态宜居");
  });

  it("多 topic 同时命中", () => {
    const r = matchTopicsForItem("美丽中国和长江保护是双碳目标的重要部分", topics);
    expect(r.length).toBe(3);
    const topicIds = r.map(m => m.topicId).sort();
    expect(topicIds).toEqual(["t1", "t2", "t3"]);
  });

  it("一个 topic 主词 + 近似词同时存在 → 仅命中主词", () => {
    const r = matchTopicsForItem("美丽中国建设是美丽中国的重要部分", topics);
    expect(r.filter(m => m.topicId === "t1").length).toBe(1);
    expect(r[0]!.matchedKeyword).toBe("美丽中国");  // 主词优先
  });

  it("无命中返回空数组", () => {
    const r = matchTopicsForItem("今天天气真好", topics);
    expect(r).toEqual([]);
  });

  it("空 text", () => {
    const r = matchTopicsForItem("", topics);
    expect(r).toEqual([]);
  });
});
