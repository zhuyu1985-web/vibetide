import { describe, expect, it } from "vitest";
import {
  parseDouyinProfileUrl,
  parseWeiboProfileUrl,
  parseKuaishouProfileUrl,
  parseWebsiteUrl,
  parseAnyChannelUrl,
} from "../url-parsers";

describe("parseDouyinProfileUrl", () => {
  it("典型 PC 端 URL", () => {
    const r = parseDouyinProfileUrl("https://www.douyin.com/user/MS4wLjABAAAAabc-123");
    expect(r).toMatchObject({ type: "douyin", secUid: "MS4wLjABAAAAabc-123" });
  });
  it("移动端 URL", () => {
    const r = parseDouyinProfileUrl("https://m.douyin.com/user/MS4wxxx");
    expect(r).toMatchObject({ type: "douyin", secUid: "MS4wxxx" });
  });
  it("share/user 路径", () => {
    const r = parseDouyinProfileUrl("https://www.iesdouyin.com/share/user/MS4wxxx");
    expect(r).toMatchObject({ type: "douyin", secUid: "MS4wxxx" });
  });
  it("短链返回 null(需要走 API 跳转)", () => {
    expect(parseDouyinProfileUrl("https://v.douyin.com/iexxx/")).toBeNull();
  });
});

describe("parseWeiboProfileUrl", () => {
  it("典型 weibo.com/u/数字", () => {
    expect(parseWeiboProfileUrl("https://weibo.com/u/2803301701")).toMatchObject({
      type: "weibo",
      uid: "2803301701",
    });
  });
  it("移动端 m.weibo.cn/u/数字", () => {
    expect(parseWeiboProfileUrl("https://m.weibo.cn/u/2803301701")).toMatchObject({
      type: "weibo",
      uid: "2803301701",
    });
  });
  it("尾巴有 /profile 也能识别", () => {
    expect(parseWeiboProfileUrl("https://www.weibo.com/u/2803301701/profile")).toMatchObject({
      uid: "2803301701",
    });
  });
});

describe("parseKuaishouProfileUrl", () => {
  it("典型 kuaishou.com/profile/xxx", () => {
    expect(parseKuaishouProfileUrl("https://www.kuaishou.com/profile/3xy4nh4nzqzkfxg")).toMatchObject({
      type: "kuaishou",
      userId: "3xy4nh4nzqzkfxg",
    });
  });
  it("live.kuaishou.com 子域", () => {
    expect(parseKuaishouProfileUrl("https://live.kuaishou.com/profile/3xy4nh4nzqzkfxg")).toMatchObject({
      userId: "3xy4nh4nzqzkfxg",
    });
  });
});

describe("parseWebsiteUrl", () => {
  it("提取域名 (剥离 www.)", () => {
    expect(parseWebsiteUrl("https://www.people.com.cn/article/xxx")).toMatchObject({
      type: "website",
      url: "https://www.people.com.cn",
      domain: "people.com.cn",
    });
  });
  it("非法 URL 返回 null", () => {
    expect(parseWebsiteUrl("not-a-url")).toBeNull();
  });
});

describe("parseAnyChannelUrl 智能识别", () => {
  it("抖音优先", () => {
    expect(parseAnyChannelUrl("https://www.douyin.com/user/MS4wxxx")?.type).toBe("douyin");
  });
  it("微博 / 快手 各归各家", () => {
    expect(parseAnyChannelUrl("https://weibo.com/u/2803301701")?.type).toBe("weibo");
    expect(parseAnyChannelUrl("https://www.kuaishou.com/profile/abc")?.type).toBe("kuaishou");
  });
  it("不认识的网址走 website 兜底", () => {
    expect(parseAnyChannelUrl("https://example.com")?.type).toBe("website");
  });
});
