import { describe, it, expect } from "vitest";
import {
  mapDouyinUserSearch,
  pickBestCandidate,
  type DouyinUserCandidate,
} from "@/lib/collection/adapters/tikhub/account-search";

// ⚠️ tikhub 抖音用户搜索真实端点未实测,这些 fixture 基于文档推测的响应形态。
// 实测后若真实结构不同,需同步调整 fixture 与 mapDouyinUserSearch。
// 这些用例固化"给定响应形态 → 解析/容错/选号"的逻辑,防回归。

describe("mapDouyinUserSearch", () => {
  it("解析 user_list[].user_info 嵌套结构的完整字段", () => {
    const resp = {
      data: {
        user_list: [
          {
            user_info: {
              sec_uid: "MS4wLjABAAAA1",
              uid: "111",
              nickname: "央视新闻",
              follower_count: 1234567,
              enterprise_verify_reason: "中央广播电视总台",
              avatar_thumb: { url_list: ["https://p.douyin/avatar1.jpg"] },
            },
          },
        ],
      },
    };
    const out = mapDouyinUserSearch(resp);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      secUid: "MS4wLjABAAAA1",
      uid: "111",
      nickname: "央视新闻",
      followerCount: 1234567,
      verified: true,
      avatarUrl: "https://p.douyin/avatar1.jpg",
    });
  });

  it("兼容字段直接挂在项上(无 user_info 嵌套)", () => {
    const resp = {
      data: { user_list: [{ sec_uid: "MS4wA", nickname: "直挂" }] },
    };
    const out = mapDouyinUserSearch(resp);
    expect(out[0]?.secUid).toBe("MS4wA");
    expect(out[0]?.nickname).toBe("直挂");
  });

  it("兼容 data.data 与 data.business_data 候选路径", () => {
    expect(mapDouyinUserSearch({ data: { data: [{ sec_uid: "A" }] } })[0]?.secUid).toBe("A");
    expect(
      mapDouyinUserSearch({ data: { business_data: [{ user_info: { sec_uid: "B" } }] } })[0]?.secUid,
    ).toBe("B");
  });

  it("跳过缺 sec_uid 的项", () => {
    const resp = {
      data: {
        user_list: [
          { user_info: { nickname: "没有secUid" } },
          { user_info: { sec_uid: "MS4wHas", nickname: "有" } },
        ],
      },
    };
    const out = mapDouyinUserSearch(resp);
    expect(out).toHaveLength(1);
    expect(out[0]?.secUid).toBe("MS4wHas");
  });

  it("custom_verify 也算认证;两者皆空为未认证", () => {
    const verifiedByCustom = mapDouyinUserSearch({
      data: { user_list: [{ sec_uid: "A", custom_verify: "知名媒体人" }] },
    });
    expect(verifiedByCustom[0]?.verified).toBe(true);

    const notVerified = mapDouyinUserSearch({
      data: { user_list: [{ sec_uid: "B", enterprise_verify_reason: "", custom_verify: "" }] },
    });
    expect(notVerified[0]?.verified).toBe(false);
  });

  it("follower_count 缺失时用 fans_count 兜底,再缺为 0", () => {
    expect(
      mapDouyinUserSearch({ data: { user_list: [{ sec_uid: "A", fans_count: 999 }] } })[0]?.followerCount,
    ).toBe(999);
    expect(
      mapDouyinUserSearch({ data: { user_list: [{ sec_uid: "A" }] } })[0]?.followerCount,
    ).toBe(0);
  });

  it("头像按 thumb → medium → larger 兜底", () => {
    const out = mapDouyinUserSearch({
      data: {
        user_list: [
          { sec_uid: "A", avatar_medium: { url_list: ["medium.jpg"] } },
          { sec_uid: "B", avatar_larger: { url_list: ["larger.jpg"] } },
        ],
      },
    });
    expect(out[0]?.avatarUrl).toBe("medium.jpg");
    expect(out[1]?.avatarUrl).toBe("larger.jpg");
  });

  it("空/非法响应返回空数组(不抛错)", () => {
    expect(mapDouyinUserSearch(null)).toEqual([]);
    expect(mapDouyinUserSearch({})).toEqual([]);
    expect(mapDouyinUserSearch({ data: {} })).toEqual([]);
    expect(mapDouyinUserSearch({ data: { user_list: [] } })).toEqual([]);
    expect(mapDouyinUserSearch("garbage")).toEqual([]);
  });
});

describe("pickBestCandidate", () => {
  const make = (over: Partial<DouyinUserCandidate>): DouyinUserCandidate => ({
    secUid: "x",
    nickname: "n",
    followerCount: 0,
    verified: false,
    ...over,
  });

  it("已认证优先,即便其粉丝少于未认证号", () => {
    const verifiedFew = make({ secUid: "v", verified: true, followerCount: 100 });
    const unverifiedMany = make({ secUid: "u", verified: false, followerCount: 999999 });
    expect(pickBestCandidate([unverifiedMany, verifiedFew])?.secUid).toBe("v");
  });

  it("同为认证时按粉丝降序取最高", () => {
    const a = make({ secUid: "a", verified: true, followerCount: 100 });
    const b = make({ secUid: "b", verified: true, followerCount: 500 });
    expect(pickBestCandidate([a, b])?.secUid).toBe("b");
  });

  it("全部未认证时按粉丝最高", () => {
    const a = make({ secUid: "a", followerCount: 10 });
    const b = make({ secUid: "b", followerCount: 80 });
    expect(pickBestCandidate([a, b])?.secUid).toBe("b");
  });

  it("空列表返回 null", () => {
    expect(pickBestCandidate([])).toBeNull();
  });
});
