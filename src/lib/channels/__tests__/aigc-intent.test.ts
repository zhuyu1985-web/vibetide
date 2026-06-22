import { describe, it, expect } from "vitest";
import { isVideoIntent, isPodcastIntent } from "../aigc-intent";

// ─── isVideoIntent 命中组 ────────────────────────────────────────────────────

describe("isVideoIntent — 命中组", () => {
  it.each([
    ["配视频", true],
    ["帮我配视频", true],
    ["做个视频", true],
    ["做条视频", true],
    ["生成视频", true],
    ["做视频", true],
    ["帮我做视频", true],
  ])("'%s' → %s", (text, expected) => {
    expect(isVideoIntent(text)).toBe(expected);
  });
});

// ─── isVideoIntent 不命中组 ──────────────────────────────────────────────────

describe("isVideoIntent — 不命中组", () => {
  it.each([
    ["写一篇AI稿", false],
    ["发布到新闻", false],
    ["加配图", false],   // 图意图，不是视频
    ["配图", false],
    ["配播客", false],   // 播客意图，不是视频
    ["做播客", false],
    ["你好", false],
  ])("'%s' → %s", (text, expected) => {
    expect(isVideoIntent(text)).toBe(expected);
  });
});

// ─── isPodcastIntent 命中组 ──────────────────────────────────────────────────

describe("isPodcastIntent — 命中组", () => {
  it.each([
    ["配播客", true],
    ["帮我配播客", true],
    ["做个播客", true],
    ["做成播客", true],
    ["生成播客", true],
    ["做播客", true],
    ["帮我做播客", true],
  ])("'%s' → %s", (text, expected) => {
    expect(isPodcastIntent(text)).toBe(expected);
  });
});

// ─── isPodcastIntent 不命中组 ────────────────────────────────────────────────

describe("isPodcastIntent — 不命中组", () => {
  it.each([
    ["写一篇AI稿", false],
    ["发布到新闻", false],
    ["加配图", false],   // 图意图
    ["配视频", false],   // 视频意图
    ["做视频", false],
    ["你好", false],
  ])("'%s' → %s", (text, expected) => {
    expect(isPodcastIntent(text)).toBe(expected);
  });
});

// ─── 互斥验证：视频 vs 播客 vs 图 ─────────────────────────────────────────────

describe("三态互斥", () => {
  it("'配视频' 只命中 isVideoIntent", () => {
    expect(isVideoIntent("配视频")).toBe(true);
    expect(isPodcastIntent("配视频")).toBe(false);
  });

  it("'配播客' 只命中 isPodcastIntent", () => {
    expect(isPodcastIntent("配播客")).toBe(true);
    expect(isVideoIntent("配播客")).toBe(false);
  });

  it("'加配图' 两者都不命中（isIllustrateIntent 管的）", () => {
    expect(isVideoIntent("加配图")).toBe(false);
    expect(isPodcastIntent("加配图")).toBe(false);
  });

  it("'写一篇AI稿' 三者都不命中", () => {
    expect(isVideoIntent("写一篇AI稿")).toBe(false);
    expect(isPodcastIntent("写一篇AI稿")).toBe(false);
  });

  it("'发布到新闻' 三者都不命中", () => {
    expect(isVideoIntent("发布到新闻")).toBe(false);
    expect(isPodcastIntent("发布到新闻")).toBe(false);
  });
});
