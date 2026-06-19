import { describe, it, expect } from "vitest";
import { extractUrls } from "../link-extract";

describe("extractUrls", () => {
  it("提取单个 http(s) 链接", () => {
    expect(extractUrls("看看这个 https://example.com/a 不错")).toEqual([
      "https://example.com/a",
    ]);
  });
  it("提取多个链接并去重", () => {
    expect(
      extractUrls("https://a.com/1 和 https://b.com/2 还有 https://a.com/1")
    ).toEqual(["https://a.com/1", "https://b.com/2"]);
  });
  it("无链接返回空数组", () => {
    expect(extractUrls("今天天气不错")).toEqual([]);
  });
  it("过滤钉钉自身域名", () => {
    expect(extractUrls("https://example.com/x https://open.dingtalk.com/y")).toEqual([
      "https://example.com/x",
    ]);
  });
  it("剥离末尾中文标点", () => {
    expect(extractUrls("链接：https://example.com/a。")).toEqual([
      "https://example.com/a",
    ]);
  });
});
