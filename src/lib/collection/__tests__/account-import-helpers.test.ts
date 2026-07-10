import { describe, it, expect } from "vitest";
import {
  resolvePlatform,
  parseUrlToId,
  validateId,
  normalizeTier,
  readField,
  buildChannel,
  channelKey,
  type ConfirmRow,
} from "@/lib/collection/account-import-helpers";

// 采集源「批量导入社媒账号」纯逻辑单测(P1 多平台)。
// 真实 tikhub 端点未测,但平台识别/URL解析路由/ID校验/归一/去重是确定逻辑。

describe("resolvePlatform", () => {
  it("中文名识别", () => {
    expect(resolvePlatform("抖音")).toBe("douyin");
    expect(resolvePlatform("微博")).toBe("weibo");
    expect(resolvePlatform("快手")).toBe("kuaishou");
    expect(resolvePlatform("微信公众号")).toBe("wechat_oa");
    expect(resolvePlatform("公众号")).toBe("wechat_oa");
    expect(resolvePlatform("微信")).toBe("wechat_oa");
  });
  it("英文名(含大小写)识别", () => {
    expect(resolvePlatform("douyin")).toBe("douyin");
    expect(resolvePlatform("DouYin")).toBe("douyin");
    expect(resolvePlatform("WEIBO")).toBe("weibo");
    expect(resolvePlatform("wechat")).toBe("wechat_oa");
  });
  it("空值默认抖音、前后空格容错", () => {
    expect(resolvePlatform("")).toBe("douyin");
    expect(resolvePlatform("   ")).toBe("douyin");
    expect(resolvePlatform("  抖音 ")).toBe("douyin");
  });
  it("无法识别返回 null", () => {
    expect(resolvePlatform("小红书")).toBeNull();
    expect(resolvePlatform("bilibili")).toBeNull();
  });
});

describe("parseUrlToId", () => {
  it("抖音完整主页 URL → secUid", () => {
    const r = parseUrlToId("douyin", "https://www.douyin.com/user/MS4wLjABAAAAxyz");
    expect(r?.id).toBe("MS4wLjABAAAAxyz");
  });
  it("微博主页 URL → uid", () => {
    const r = parseUrlToId("weibo", "https://weibo.com/u/2803301701");
    expect(r?.id).toBe("2803301701");
  });
  it("快手主页 URL → userId", () => {
    const r = parseUrlToId("kuaishou", "https://www.kuaishou.com/profile/3xy4nh4nzqzkfxg");
    expect(r?.id).toBe("3xy4nh4nzqzkfxg");
  });
  it("公众号无 URL 解析,恒返回 null", () => {
    expect(parseUrlToId("wechat_oa", "https://mp.weixin.qq.com/xxx")).toBeNull();
  });
  it("无法解析的 URL → null(抖音短链不在同步解析范围)", () => {
    expect(parseUrlToId("douyin", "https://v.douyin.com/iAbCdE/")).toBeNull();
    expect(parseUrlToId("weibo", "not a url")).toBeNull();
  });
  it("平台与 URL 不匹配 → null", () => {
    expect(parseUrlToId("weibo", "https://www.douyin.com/user/MS4wLjABAAAAxyz")).toBeNull();
  });
});

describe("validateId", () => {
  it("微博 uid 必须数字", () => {
    expect(validateId("weibo", "2803301701")).toBeNull();
    expect(validateId("weibo", "abc")).toMatch(/数字/);
  });
  it("公众号 ghid 必须 gh_ 开头", () => {
    expect(validateId("wechat_oa", "gh_abcdef123456")).toBeNull();
    expect(validateId("wechat_oa", "abcdef")).toMatch(/gh_/);
  });
  it("抖音/快手账号 ID 非空即可", () => {
    expect(validateId("douyin", "MS4wLjABAAAA")).toBeNull();
    expect(validateId("kuaishou", "3xy4nh")).toBeNull();
    expect(validateId("douyin", "  ")).toMatch(/不能为空/);
  });
});

describe("normalizeTier", () => {
  it("中文 label → 枚举值", () => {
    expect(normalizeTier("央级媒体")).toBe("central");
    expect(normalizeTier("政务新媒体")).toBe("government_self_media");
  });
  it("已是枚举值原样保留", () => {
    expect(normalizeTier("central")).toBe("central");
  });
  it("空/非法 → 默认政务新媒体", () => {
    expect(normalizeTier("")).toBe("government_self_media");
    expect(normalizeTier("乱填的分级")).toBe("government_self_media");
  });
});

describe("readField", () => {
  it("按 keys 顺序取第一个非空", () => {
    expect(readField({ 媒体名称: "中国日报", name: "x" }, ["媒体名称", "name"])).toBe("中国日报");
    expect(readField({ name: "fallback" }, ["媒体名称", "name"])).toBe("fallback");
  });
  it("数字转字符串、前后空格 trim", () => {
    expect(readField({ uid: 2803301701 }, ["uid"])).toBe("2803301701");
    expect(readField({ 名称: "  人民日报  " }, ["名称"])).toBe("人民日报");
  });
  it("全空返回空串", () => {
    expect(readField({ 名称: "   " }, ["名称", "缺失列"])).toBe("");
    expect(readField({}, ["a", "b"])).toBe("");
  });
});

function confirmRow(partial: Partial<ConfirmRow> & Pick<ConfirmRow, "platform" | "identifier">): ConfirmRow {
  return {
    outletName: "测试媒体",
    nickname: "测试昵称",
    outletTier: "central",
    outletRegion: "全国",
    groupName: null,
    description: null,
    profileUrl: null,
    ...partial,
  };
}

describe("buildChannel", () => {
  it("各平台映射到正确的 channel 字段", () => {
    expect(buildChannel(confirmRow({ platform: "douyin", identifier: "MS4wXYZ", nickname: "抖音号" }))).toMatchObject({
      type: "douyin",
      nickname: "抖音号",
      secUid: "MS4wXYZ",
    });
    expect(buildChannel(confirmRow({ platform: "weibo", identifier: "123" }))).toMatchObject({
      type: "weibo",
      uid: "123",
    });
    expect(buildChannel(confirmRow({ platform: "kuaishou", identifier: "ks1" }))).toMatchObject({
      type: "kuaishou",
      userId: "ks1",
    });
    expect(buildChannel(confirmRow({ platform: "wechat_oa", identifier: "gh_x", nickname: "公众号名" }))).toMatchObject({
      type: "wechat_oa",
      name: "公众号名",
      ghid: "gh_x",
    });
  });
  it("profileUrl 为空时不写入该字段", () => {
    const ch = buildChannel(confirmRow({ platform: "douyin", identifier: "MS4w", profileUrl: null }));
    expect("profileUrl" in ch).toBe(false);
  });
  it("profileUrl 非空时写入", () => {
    const ch = buildChannel(
      confirmRow({ platform: "douyin", identifier: "MS4w", profileUrl: "https://www.douyin.com/user/MS4w" }),
    );
    expect(ch).toMatchObject({ profileUrl: "https://www.douyin.com/user/MS4w" });
  });
});

describe("channelKey(去重键)", () => {
  it("同平台同 ID → 相同 key(幂等合并)", () => {
    const a = buildChannel(confirmRow({ platform: "douyin", identifier: "MS4wSame" }));
    const b = buildChannel(confirmRow({ platform: "douyin", identifier: "MS4wSame", nickname: "改了昵称" }));
    expect(channelKey(a)).toBe(channelKey(b));
  });
  it("同平台不同 ID → 不同 key(同 outlet 多账号全保留)", () => {
    const a = buildChannel(confirmRow({ platform: "douyin", identifier: "MS4wA" }));
    const b = buildChannel(confirmRow({ platform: "douyin", identifier: "MS4wB" }));
    expect(channelKey(a)).not.toBe(channelKey(b));
  });
  it("不同平台 → 不同 key", () => {
    const dy = buildChannel(confirmRow({ platform: "douyin", identifier: "x" }));
    const wb = buildChannel(confirmRow({ platform: "weibo", identifier: "123" }));
    expect(channelKey(dy)).not.toBe(channelKey(wb));
  });
});
