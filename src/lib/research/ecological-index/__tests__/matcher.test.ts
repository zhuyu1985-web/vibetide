import { describe, it, expect } from "vitest";
import {
  matchUnitToOutlets,
  matchScopeToOutlets,
  type MatchableUnit,
  type OutletDictRow,
} from "../matcher";

describe("matcher", () => {
  it("ghid 精确匹配 (优先级 1)", () => {
    const unit: MatchableUnit = {
      unitId: "u1",
      tier: "central",
      xlsxRow: 2,
      name: "人民日报",
      wechatNames: ["人民日报"],
      wechatGhid: "gh_f8245afd69b7",
      weiboUid: "2803301701",
      websites: ["people.com.cn"],
    };
    const dict: OutletDictRow[] = [
      {
        outletId: "o1",
        outletName: "人民日报",
        publicAccountNames: ["gh_f8245afd69b7", "人民日报"],
        domains: ["people.com.cn"],
      },
    ];
    const r = matchUnitToOutlets(unit, dict);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]!.priority).toBe(1);
    expect(r.matched[0]!.signal).toBe("ghid=gh_f8245afd69b7");
  });

  it("weibo UID 匹配 (优先级 2, 当无 ghid)", () => {
    const unit: MatchableUnit = {
      unitId: "u1",
      tier: "central",
      xlsxRow: 2,
      name: "央视新闻",
      wechatNames: ["央视新闻"],
      wechatGhid: null,
      weiboUid: "2656274875",
      websites: ["cctv.com"],
    };
    const dict: OutletDictRow[] = [
      {
        outletId: "o1",
        outletName: "央视新闻",
        publicAccountNames: ["2656274875"],
        domains: ["cctv.com"],
      },
    ];
    const r = matchUnitToOutlets(unit, dict);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]!.priority).toBe(2);
    expect(r.matched[0]!.signal).toBe("weibo_uid=2656274875");
  });

  it("公众号名精确匹配 (优先级 3)", () => {
    const unit: MatchableUnit = {
      unitId: "u1",
      tier: "central",
      xlsxRow: 6,
      name: "上游新闻",
      wechatNames: ["上游新闻"],
      wechatGhid: null,
      weiboUid: null,
      websites: ["cqcb.com"],
    };
    const dict: OutletDictRow[] = [
      {
        outletId: "o1",
        outletName: "上游新闻",
        publicAccountNames: ["上游新闻"],
        domains: ["cqcb.com"],
      },
    ];
    const r = matchUnitToOutlets(unit, dict);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]!.priority).toBe(3);
  });

  it("域名匹配 (优先级 4, 当公众号名都不命中)", () => {
    const unit: MatchableUnit = {
      unitId: "u1",
      tier: "municipal",
      xlsxRow: 8,
      name: "重庆广电",
      wechatNames: ["第1眼新闻"],
      wechatGhid: null,
      weiboUid: null,
      websites: ["1tv.com.cn"],
    };
    const dict: OutletDictRow[] = [
      {
        outletId: "o1",
        outletName: "X X 媒体", // 名字不匹配
        publicAccountNames: [], // 公众号不匹配
        domains: ["1tv.com.cn"],
      },
    ];
    const r = matchUnitToOutlets(unit, dict);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]!.priority).toBe(4);
    expect(r.matched[0]!.signal).toBe("domain=1tv.com.cn");
  });

  it("outlet_name 双向 contains (优先级 5)", () => {
    const unit: MatchableUnit = {
      unitId: "u1",
      tier: "central",
      xlsxRow: 2,
      name: "人民日报",
      wechatNames: [],
      wechatGhid: null,
      weiboUid: null,
      websites: [],
    };
    const dict: OutletDictRow[] = [
      {
        outletId: "o1",
        outletName: "人民日报(党媒)", // outletName.includes("人民日报")
        publicAccountNames: [],
        domains: [],
      },
    ];
    const r = matchUnitToOutlets(unit, dict);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]!.priority).toBe(5);
  });

  it("ghid 冲突: 重庆日报 (municipal L9) vs 西部科学城 (district_rmt L48)", () => {
    const units: MatchableUnit[] = [
      {
        unitId: "u_cqrb",
        tier: "municipal",
        xlsxRow: 9,
        name: "重庆日报",
        wechatNames: ["重庆日报"],
        wechatGhid: "gh_27de3a2c6bc4",
        weiboUid: null,
        websites: ["cqrb.cn"],
      },
      {
        unitId: "u_xkc",
        tier: "district_rmt",
        xlsxRow: 48,
        name: "西部科学城",
        wechatNames: ["西部科学城重庆高新区"],
        wechatGhid: "gh_27de3a2c6bc4",
        weiboUid: null,
        websites: [],
      },
    ];
    const dict: OutletDictRow[] = [
      {
        outletId: "o_share",
        outletName: "shared",
        publicAccountNames: ["gh_27de3a2c6bc4"],
        domains: ["cqrb.cn"],
      },
    ];
    const result = matchScopeToOutlets(units, dict);
    // outlet 应归 municipal 优先级更高的"重庆日报"
    expect(result.get("u_cqrb")).toContain("o_share");
    expect(result.get("u_xkc") ?? []).toEqual([]);
  });

  it("weibo UID 冲突: 美丽重庆 (industry L12) vs 重庆市生态环境局 (district_gov L92)", () => {
    const units: MatchableUnit[] = [
      {
        unitId: "u_mlcq",
        tier: "industry",
        xlsxRow: 12,
        name: "美丽重庆",
        wechatNames: ["美丽重庆"],
        wechatGhid: null,
        weiboUid: "2144075181",
        websites: [],
      },
      {
        unitId: "u_sjhj",
        tier: "district_gov",
        xlsxRow: 92,
        name: "重庆市生态环境局",
        wechatNames: ["重庆生态环境"],
        wechatGhid: null,
        weiboUid: "2144075181",
        websites: [],
      },
    ];
    const dict: OutletDictRow[] = [
      {
        outletId: "o_weibo",
        outletName: "shared weibo",
        publicAccountNames: ["2144075181"],
        domains: [],
      },
    ];
    const result = matchScopeToOutlets(units, dict);
    expect(result.get("u_mlcq")).toContain("o_weibo");
    expect(result.get("u_sjhj") ?? []).toEqual([]);
  });

  it("weibo UID 冲突: 黔江发布 (district_rmt L53) vs 黔江生态环境局 (district_gov L95)", () => {
    const units: MatchableUnit[] = [
      {
        unitId: "u_qj_rmt",
        tier: "district_rmt",
        xlsxRow: 53,
        name: "黔江发布",
        wechatNames: ["黔江发布"],
        wechatGhid: null,
        weiboUid: "2780124485",
        websites: [],
      },
      {
        unitId: "u_qj_gov",
        tier: "district_gov",
        xlsxRow: 95,
        name: "黔江区生态环境局",
        wechatNames: [],
        wechatGhid: null,
        weiboUid: "2780124485",
        websites: [],
      },
    ];
    const dict: OutletDictRow[] = [
      {
        outletId: "o_share",
        outletName: "shared",
        publicAccountNames: ["2780124485"],
        domains: [],
      },
    ];
    const result = matchScopeToOutlets(units, dict);
    expect(result.get("u_qj_rmt")).toContain("o_share");
    expect(result.get("u_qj_gov") ?? []).toEqual([]);
  });

  it("同 tier 同信号冲突 → xlsxRow 升序裁决", () => {
    const units: MatchableUnit[] = [
      {
        unitId: "u_a",
        tier: "central",
        xlsxRow: 5,
        name: "A",
        wechatNames: [],
        wechatGhid: "gh_share",
        weiboUid: null,
        websites: [],
      },
      {
        unitId: "u_b",
        tier: "central",
        xlsxRow: 3,
        name: "B",
        wechatNames: [],
        wechatGhid: "gh_share",
        weiboUid: null,
        websites: [],
      },
    ];
    const dict: OutletDictRow[] = [
      {
        outletId: "o_share",
        outletName: "shared",
        publicAccountNames: ["gh_share"],
        domains: [],
      },
    ];
    const result = matchScopeToOutlets(units, dict);
    // L3 < L5 → 归 u_b
    expect(result.get("u_b")).toContain("o_share");
    expect(result.get("u_a") ?? []).toEqual([]);
  });
});
