import { describe, it, expect } from "vitest";
import { splitTitleBody, deriveTitle } from "../revise";

describe("splitTitleBody", () => {
  it("首行标题 + 其后正文", () => {
    expect(splitTitleBody("我的标题\n\n正文一\n正文二", "兜底")).toEqual({ title: "我的标题", body: "正文一\n正文二" });
  });
  it("去 markdown # 与 标题: 前缀", () => {
    expect(splitTitleBody("# 标题：真题\n\n正文", "兜底").title).toBe("真题");
  });
  it("无正文 → 整段当正文，标题用兜底", () => {
    expect(splitTitleBody("只有一行", "兜底").body).toBe("只有一行");
  });
});
describe("deriveTitle", () => {
  it("取首个非空行（≤60）", () => { expect(deriveTitle("标题行\n正文", "fb")).toBe("标题行"); });
  it("首行过长 → 用兜底截断", () => { expect(deriveTitle("x".repeat(80), "兜底")).toBe("兜底"); });
});
