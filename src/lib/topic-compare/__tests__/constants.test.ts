import { describe, it, expect } from "vitest";
import { TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS, isTikhubAccountSupported } from "../constants";

describe("TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS", () => {
  it("精确包含 4 个平台", () => {
    expect([...TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS].sort()).toEqual(
      ["douyin", "kuaishou", "wechat_mp", "weibo"].sort(),
    );
  });

  it("isTikhubAccountSupported 对白名单返回 true", () => {
    expect(isTikhubAccountSupported("douyin")).toBe(true);
    expect(isTikhubAccountSupported("weibo")).toBe(true);
  });

  it("isTikhubAccountSupported 对非白名单返回 false", () => {
    expect(isTikhubAccountSupported("xiaohongshu")).toBe(false);
    expect(isTikhubAccountSupported("wechat_channels")).toBe(false);
    expect(isTikhubAccountSupported("zhihu")).toBe(false);
  });
});
