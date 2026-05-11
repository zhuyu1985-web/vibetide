import { describe, expect, it } from "vitest";
import {
  channelSchema,
  channelsArraySchema,
  getChannelIdentifier,
  getChannelDisplayName,
  CHANNEL_TIKHUB_SUPPORT,
  type Channel,
} from "../channels";

describe("channel zod schema", () => {
  it("website channel: 合法 URL + domain 通过校验", () => {
    const ch = { type: "website", url: "https://people.com.cn", domain: "people.com.cn" };
    expect(channelSchema.parse(ch)).toEqual(ch);
  });

  it("website channel: 非法 URL 报错", () => {
    expect(() =>
      channelSchema.parse({ type: "website", url: "not-a-url", domain: "x" }),
    ).toThrow();
  });

  it("wechat_oa: 仅 name 必填,ghid 可选;ghid 必须以 gh_ 开头", () => {
    expect(
      channelSchema.parse({ type: "wechat_oa", name: "人民日报" }),
    ).toBeTruthy();
    expect(
      channelSchema.parse({ type: "wechat_oa", name: "人民日报", ghid: "gh_a3d35d4c9d3f" }),
    ).toBeTruthy();
    expect(() =>
      channelSchema.parse({ type: "wechat_oa", name: "x", ghid: "invalid_no_prefix" }),
    ).toThrow();
  });

  it("douyin: secUid 必填", () => {
    expect(
      channelSchema.parse({ type: "douyin", nickname: "人民日报", secUid: "MS4wLjABxxx" }),
    ).toBeTruthy();
    expect(() =>
      channelSchema.parse({ type: "douyin", nickname: "x" }),
    ).toThrow();
  });

  it("weibo: uid 必须是数字串", () => {
    expect(
      channelSchema.parse({ type: "weibo", nickname: "人民日报", uid: "2803301701" }),
    ).toBeTruthy();
    expect(() =>
      channelSchema.parse({ type: "weibo", nickname: "x", uid: "not-digits" }),
    ).toThrow();
  });

  it("kuaishou: userId 必填", () => {
    expect(
      channelSchema.parse({ type: "kuaishou", nickname: "人民日报", userId: "3xy4nh4nzqzkfxg" }),
    ).toBeTruthy();
  });

  it("数组校验: 混合多平台账号", () => {
    const channels: Channel[] = [
      { type: "website", url: "https://people.com.cn", domain: "people.com.cn" },
      { type: "wechat_oa", name: "人民日报", ghid: "gh_a3d35d4c9d3f" },
      { type: "douyin", nickname: "人民日报", secUid: "MS4wLjABxxx" },
      { type: "weibo", nickname: "人民日报", uid: "2803301701" },
    ];
    expect(channelsArraySchema.parse(channels)).toEqual(channels);
  });
});

describe("getChannelIdentifier", () => {
  it("website 返回 domain", () => {
    expect(
      getChannelIdentifier({ type: "website", url: "https://x.com", domain: "x.com" }),
    ).toBe("x.com");
  });

  it("wechat_oa 返回 ghid;无 ghid 返回 null", () => {
    expect(
      getChannelIdentifier({ type: "wechat_oa", name: "人民日报", ghid: "gh_abc" }),
    ).toBe("gh_abc");
    expect(
      getChannelIdentifier({ type: "wechat_oa", name: "人民日报" }),
    ).toBeNull();
  });

  it("douyin 返回 secUid", () => {
    expect(
      getChannelIdentifier({ type: "douyin", nickname: "x", secUid: "MS4wxxx" }),
    ).toBe("MS4wxxx");
  });
});

describe("getChannelDisplayName", () => {
  it("website 返回 domain;微社交平台返回 nickname/name", () => {
    expect(
      getChannelDisplayName({ type: "website", url: "https://x.com", domain: "x.com" }),
    ).toBe("x.com");
    expect(
      getChannelDisplayName({ type: "wechat_oa", name: "人民日报" }),
    ).toBe("人民日报");
    expect(
      getChannelDisplayName({ type: "douyin", nickname: "人民日报", secUid: "x" }),
    ).toBe("人民日报");
  });
});

describe("CHANNEL_TIKHUB_SUPPORT", () => {
  it("4 个社媒平台都标记 supported=true", () => {
    expect(CHANNEL_TIKHUB_SUPPORT.wechat_oa.supported).toBe(true);
    expect(CHANNEL_TIKHUB_SUPPORT.douyin.supported).toBe(true);
    expect(CHANNEL_TIKHUB_SUPPORT.weibo.supported).toBe(true);
    expect(CHANNEL_TIKHUB_SUPPORT.kuaishou.supported).toBe(true);
  });

  it("website supported=false (没有 tikhub 端点,走 RSS 或人工)", () => {
    expect(CHANNEL_TIKHUB_SUPPORT.website.supported).toBe(false);
  });

  it("identifierField 对齐 Channel 类型字段名", () => {
    expect(CHANNEL_TIKHUB_SUPPORT.wechat_oa.identifierField).toBe("ghid");
    expect(CHANNEL_TIKHUB_SUPPORT.douyin.identifierField).toBe("secUid");
    expect(CHANNEL_TIKHUB_SUPPORT.weibo.identifierField).toBe("uid");
    expect(CHANNEL_TIKHUB_SUPPORT.kuaishou.identifierField).toBe("userId");
  });
});
