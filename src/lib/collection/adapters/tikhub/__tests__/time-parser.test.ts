import { describe, expect, it } from "vitest";
import { parseWeiboTime, parseTimestampMs, parseTimestampSec } from "../time-parser";

describe("parseWeiboTime", () => {
  const ref = new Date("2026-05-05T12:00:00.000Z");

  it("刚刚 → 当前时间", () => {
    expect(parseWeiboTime("刚刚", ref)?.getTime()).toBe(ref.getTime());
  });

  it("5 分钟前", () => {
    const result = parseWeiboTime("5 分钟前", ref);
    expect(result?.getTime()).toBe(ref.getTime() - 5 * 60 * 1000);
  });

  it("3 小时前", () => {
    const result = parseWeiboTime("3 小时前", ref);
    expect(result?.getTime()).toBe(ref.getTime() - 3 * 60 * 60 * 1000);
  });

  it("今天 14:30", () => {
    const result = parseWeiboTime("今天 14:30", ref);
    expect(result?.getHours()).toBe(14);
    expect(result?.getMinutes()).toBe(30);
  });

  it("12-01（无年份，用 ref 年）", () => {
    const result = parseWeiboTime("12-01", ref);
    expect(result?.getFullYear()).toBe(2026);
    expect(result?.getMonth()).toBe(11);
    expect(result?.getDate()).toBe(1);
  });

  it("12-01 10:23（带时间）", () => {
    const result = parseWeiboTime("12-01 10:23", ref);
    expect(result?.getMonth()).toBe(11);
    expect(result?.getHours()).toBe(10);
  });

  it("ISO 字符串 2025-06-15", () => {
    const result = parseWeiboTime("2025-06-15", ref);
    expect(result?.getFullYear()).toBe(2025);
    expect(result?.getMonth()).toBe(5);
  });

  it("无效字符串返回 undefined", () => {
    expect(parseWeiboTime("aaa", ref)).toBeUndefined();
    expect(parseWeiboTime("", ref)).toBeUndefined();
  });
});

describe("parseTimestampMs / parseTimestampSec", () => {
  it("毫秒 timestamp", () => {
    expect(parseTimestampMs(1733054400000)?.toISOString()).toBe("2024-12-01T12:00:00.000Z");
  });
  it("秒 timestamp", () => {
    expect(parseTimestampSec(1733054400)?.toISOString()).toBe("2024-12-01T12:00:00.000Z");
  });
  it("0 / null / 非法值", () => {
    expect(parseTimestampMs(0)).toBeUndefined();
    expect(parseTimestampMs(null as never)).toBeUndefined();
    expect(parseTimestampSec(undefined as never)).toBeUndefined();
  });
});
