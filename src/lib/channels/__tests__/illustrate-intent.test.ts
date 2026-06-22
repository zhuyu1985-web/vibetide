import { describe, it, expect } from "vitest";
import { isIllustrateIntent } from "../illustrate-intent";

describe("isIllustrateIntent — 命中组", () => {
  it.each([
    ["加配图", true],
    ["帮我加配图", true],
    ["配图", true],
    ["请配图", true],
    ["配个图", true],
    ["来配个图", true],
    ["加个图", true],
    ["加个图吧", true],
    ["配张图", true],
    ["给我配张图", true],
    ["来张图", true],
    ["来张图片", true],
    ["加张图", true],
    ["帮文章加张图", true],
  ])("'%s' → %s", (text, expected) => {
    expect(isIllustrateIntent(text)).toBe(expected);
  });
});

describe("isIllustrateIntent — 不命中组", () => {
  it.each([
    ["写一篇AI稿", false],
    ["发布到新闻", false],
    ["抓热点", false],
    ["取消", false],
    ["你好", false],
    ["帮我写一篇关于AI的文章", false],
    ["发布到app_news频道", false],
    ["检索最新热点", false],
    ["帮我搜索", false],
    ["撤销操作", false],
  ])("'%s' → %s", (text, expected) => {
    expect(isIllustrateIntent(text)).toBe(expected);
  });
});
