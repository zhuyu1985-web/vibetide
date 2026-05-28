// src/lib/research/ecological-index/__tests__/compute.test.ts
//
// 生态文明传播指数 - 核心算法 compute.ts 单测
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.2

import { describe, expect, it } from "vitest";
import {
  computeIndicators,
  MEDIA_TIERS,
  normalizeDistrict,
  richnessF,
  scaleToRange,
  SUB_WEIGHT,
  TIER_WEIGHT,
  type ComputeItem,
} from "../compute";
import type { ActivityDataPoint } from "@/db/schema/research/activity-datasets";

describe("richnessF 主题丰富度公式", () => {
  it("16 主题均匀分布 → F = 16 (理论上限)", () => {
    const counts = Array(16).fill(10);
    expect(richnessF(counts, 16)).toBe(16);
  });

  it("集中 1 主题 → F ≈ 16/15", () => {
    // 全部集中在 topic 0:p_0 = 1, 其他 p = 0
    // Σ |p_t − 1/16| = |1 − 1/16| + 15 × |0 − 1/16|
    //               = 15/16 + 15/16 = 30/16
    // F = 1 / (30/16) = 16/30 = 8/15
    const counts = Array(16).fill(0);
    counts[0] = 100;
    expect(richnessF(counts, 16)).toBeCloseTo(16 / 30, 5);
  });

  it("total = 0 → F = 0", () => {
    expect(richnessF([0, 0, 0, 0, 0], 5)).toBe(0);
  });

  it("空数组 → F = 0", () => {
    expect(richnessF([], 16)).toBe(0);
  });

  it("公式合理性: 越均匀 F 越大", () => {
    const skewed = [100, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    const even = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
    expect(richnessF(even, 16)).toBeGreaterThan(richnessF(skewed, 16));
  });

  it("5 主题均匀分布 → F = 5 (活动公式上限)", () => {
    expect(richnessF([1, 1, 1, 1, 1], 5)).toBe(5);
  });

  it("counts 长度 < N 时,缺失位按 0 处理", () => {
    // counts 只给 3 个但 N = 5 → 后两位按 0 计算
    const partial = richnessF([5, 5, 5], 5);
    const full = richnessF([5, 5, 5, 0, 0], 5);
    expect(partial).toBeCloseTo(full, 10);
  });
});

describe("scaleToRange min-max 区间化", () => {
  it("39 区县同分 → 全 80", () => {
    const values = Array(39).fill(50);
    const scaled = scaleToRange(values);
    expect(scaled.every((v) => v === 80)).toBe(true);
  });

  it("max=min 边界(2 个值都一样)", () => {
    expect(scaleToRange([5, 5])).toEqual([80, 80]);
  });

  it("min → 65, max → 95", () => {
    const values = [10, 50, 90];
    const scaled = scaleToRange(values);
    expect(scaled[0]).toBeCloseTo(65, 5);
    expect(scaled[2]).toBeCloseTo(95, 5);
    expect(scaled[1]).toBeCloseTo(80, 5);
  });

  it("空数组 → 空数组", () => {
    expect(scaleToRange([])).toEqual([]);
  });

  it("线性单调: 输入越大输出越大", () => {
    const scaled = scaleToRange([1, 2, 3, 4, 5]);
    for (let i = 1; i < scaled.length; i += 1) {
      expect(scaled[i]!).toBeGreaterThan(scaled[i - 1]!);
    }
  });
});

describe("normalizeDistrict 区县归并", () => {
  it("江北区 → 两江新区", () => {
    expect(normalizeDistrict("江北区")).toBe("两江新区");
  });

  it("渝北区 → 两江新区", () => {
    expect(normalizeDistrict("渝北区")).toBe("两江新区");
  });

  it("其他区县不变", () => {
    expect(normalizeDistrict("万州区")).toBe("万州区");
    expect(normalizeDistrict("两江新区")).toBe("两江新区");
  });
});

describe("AHP 权重 sanity", () => {
  it("一级权重和 = 1.00", () => {
    const sum =
      TIER_WEIGHT.central +
      TIER_WEIGHT.industry +
      TIER_WEIGHT.municipal +
      TIER_WEIGHT.district +
      TIER_WEIGHT.public;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("二级权重和 = 1.00", () => {
    const sum = SUB_WEIGHT.count + SUB_WEIGHT.richness + SUB_WEIGHT.freq;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it("MEDIA_TIERS 含 4 个 tier(央/行业/市级/区县)", () => {
    expect([...MEDIA_TIERS]).toEqual(["central", "industry", "municipal", "district"]);
  });
});

describe("computeIndicators 端到端 fixture", () => {
  // 简化 fixture: 3 个区县 × 4 tier × 16 主题 + 公众活动
  const districts = ["甲区", "乙区", "丙区"];

  const items: ComputeItem[] = [
    // 甲区: 中央 5 篇,前 4 个主题各 1 篇 + topic 0 多 1 篇
    ...[0, 1, 2, 3].map(
      (tIdx, i): ComputeItem => ({
        itemId: `i-jia-c-${i}`,
        districtName: "甲区",
        tier: "central",
        topicIdx: tIdx,
        publishedDate: `2025-01-${(i + 1).toString().padStart(2, "0")}`,
      }),
    ),
    {
      itemId: "i-jia-c-4",
      districtName: "甲区",
      tier: "central",
      topicIdx: 0,
      publishedDate: "2025-01-05",
    },
    // 乙区: 中央 3 篇,集中 1 个主题
    {
      itemId: "i-yi-c-0",
      districtName: "乙区",
      tier: "central",
      topicIdx: 5,
      publishedDate: "2025-02-01",
    },
    {
      itemId: "i-yi-c-1",
      districtName: "乙区",
      tier: "central",
      topicIdx: 5,
      publishedDate: "2025-02-02",
    },
    {
      itemId: "i-yi-c-2",
      districtName: "乙区",
      tier: "central",
      topicIdx: 5,
      publishedDate: "2025-02-03",
    },
    // 丙区: 中央 0 篇
  ];

  const activities: ActivityDataPoint[] = [
    {
      district: "甲区",
      themes: { a: 1, b: 1, c: 1, d: 1, e: 1 },
      total: 5,
      firstDate: "2025-01-01",
      lastDate: "2025-12-31",
      spanDays: 365,
      freq: 5 / 365,
    },
    {
      district: "乙区",
      themes: { a: 10, b: 0, c: 0, d: 0, e: 0 },
      total: 10,
      firstDate: "2025-06-01",
      lastDate: "2025-06-30",
      spanDays: 30,
      freq: 10 / 30,
    },
    {
      district: "丙区",
      themes: { a: 0, b: 0, c: 0, d: 0, e: 0 },
      total: 0,
      firstDate: "2025-01-01",
      lastDate: "2025-01-01",
      spanDays: 1,
      freq: 0,
    },
  ];

  const result = computeIndicators(districts, items, activities);

  it("ranked 长度 = 区县数", () => {
    expect(result.ranked).toHaveLength(3);
  });

  it("ranked 按 composite 降序排列", () => {
    for (let i = 1; i < result.ranked.length; i += 1) {
      expect(result.ranked[i - 1]!.composite).toBeGreaterThanOrEqual(result.ranked[i]!.composite);
    }
  });

  it("rank 字段从 1 开始连续", () => {
    expect(result.ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("rawMedia 含 4 tier × 3 区县", () => {
    expect(Object.keys(result.rawMedia).sort()).toEqual([...districts].sort());
    for (const d of districts) {
      expect(Object.keys(result.rawMedia[d]!).sort()).toEqual([
        "central",
        "district",
        "industry",
        "municipal",
      ]);
    }
  });

  it("甲区中央 count = 5", () => {
    expect(result.rawMedia["甲区"]!.central.count).toBe(5);
  });

  it("甲区中央 days = 5 (5 个不同日期)", () => {
    expect(result.rawMedia["甲区"]!.central.days).toBe(5);
  });

  it("甲区中央 freq = 1.0 (5 篇 / 5 天)", () => {
    expect(result.rawMedia["甲区"]!.central.freq).toBeCloseTo(1.0, 5);
  });

  it("乙区中央 freq = 1.0 (3 篇 / 3 天)", () => {
    expect(result.rawMedia["乙区"]!.central.freq).toBeCloseTo(1.0, 5);
  });

  it("丙区中央 count = 0 + richness = 0 + freq = 0", () => {
    const c = result.rawMedia["丙区"]!.central;
    expect(c.count).toBe(0);
    expect(c.richness).toBe(0);
    expect(c.freq).toBe(0);
  });

  it("topicCounts 长度 = 16", () => {
    expect(result.rawMedia["甲区"]!.central.topicCounts).toHaveLength(16);
  });

  it("甲区 topic 0 命中 2 次 (因为 i-jia-c-0 和 i-jia-c-4 都命中)", () => {
    expect(result.rawMedia["甲区"]!.central.topicCounts[0]).toBe(2);
  });

  it("甲区主题分布比乙区均匀 → richness 更大", () => {
    expect(result.rawMedia["甲区"]!.central.richness).toBeGreaterThan(
      result.rawMedia["乙区"]!.central.richness,
    );
  });

  it("rawPublic 含 3 区县", () => {
    expect(Object.keys(result.rawPublic).sort()).toEqual([...districts].sort());
  });

  it("甲区公众 count = 5, 主题均匀 → richness 接近 5", () => {
    expect(result.rawPublic["甲区"]!.count).toBe(5);
    expect(result.rawPublic["甲区"]!.richness).toBeCloseTo(5, 5);
  });

  it("乙区公众主题集中 → richness 较小", () => {
    expect(result.rawPublic["乙区"]!.richness).toBeLessThan(result.rawPublic["甲区"]!.richness);
  });

  it("丙区公众无数据 → 全 0", () => {
    expect(result.rawPublic["丙区"]!.count).toBe(0);
    expect(result.rawPublic["丙区"]!.richness).toBe(0);
    expect(result.rawPublic["丙区"]!.freq).toBe(0);
  });

  it("scaled 媒体值在 [65, 95] 区间内", () => {
    for (const d of districts) {
      const m = result.scaledMedia[d]!;
      for (const tier of ["central", "industry", "municipal", "district"] as const) {
        expect(m[tier].count).toBeGreaterThanOrEqual(65);
        expect(m[tier].count).toBeLessThanOrEqual(95);
        expect(m[tier].richness).toBeGreaterThanOrEqual(65);
        expect(m[tier].richness).toBeLessThanOrEqual(95);
        expect(m[tier].freq).toBeGreaterThanOrEqual(65);
        expect(m[tier].freq).toBeLessThanOrEqual(95);
      }
    }
  });

  it("scaled 公众值在 [65, 95] 区间内", () => {
    for (const d of districts) {
      const p = result.scaledPublic[d]!;
      expect(p.count).toBeGreaterThanOrEqual(65);
      expect(p.count).toBeLessThanOrEqual(95);
      expect(p.richness).toBeGreaterThanOrEqual(65);
      expect(p.richness).toBeLessThanOrEqual(95);
      expect(p.freq).toBeGreaterThanOrEqual(65);
      expect(p.freq).toBeLessThanOrEqual(95);
    }
  });

  it("综合分 = 5 一级加权和", () => {
    const top = result.ranked[0]!;
    const expected =
      top.central * 0.45 +
      top.industry * 0.25 +
      top.municipal * 0.15 +
      top.district * 0.08 +
      top.public * 0.07;
    expect(top.composite).toBeCloseTo(expected, 5);
  });

  it("stats: max/min/span/mean 合理", () => {
    const { max, min, span, mean } = result.stats;
    expect(max).toBeGreaterThanOrEqual(min);
    expect(span).toBeCloseTo(max - min, 5);
    expect(mean).toBeGreaterThanOrEqual(min);
    expect(mean).toBeLessThanOrEqual(max);
  });

  it("stats: stdev >= 0", () => {
    expect(result.stats.stdev).toBeGreaterThanOrEqual(0);
  });

  it("分层: high + mid + low = 区县数", () => {
    expect(result.stats.tier_high + result.stats.tier_mid + result.stats.tier_low).toBe(3);
  });
});

describe("computeIndicators 区县归并", () => {
  it("江北区 / 渝北区 数据合并到 两江新区", () => {
    const districts = ["两江新区"];
    const items: ComputeItem[] = [
      // 三种 districtName 都应汇入两江新区
      {
        itemId: "i1",
        districtName: "江北区",
        tier: "central",
        topicIdx: 0,
        publishedDate: "2025-01-01",
      },
      {
        itemId: "i2",
        districtName: "渝北区",
        tier: "central",
        topicIdx: 1,
        publishedDate: "2025-01-02",
      },
      {
        itemId: "i3",
        districtName: "两江新区",
        tier: "central",
        topicIdx: 2,
        publishedDate: "2025-01-03",
      },
    ];
    const result = computeIndicators(districts, items, []);
    expect(result.rawMedia["两江新区"]!.central.count).toBe(3);
    expect(result.rawMedia["两江新区"]!.central.days).toBe(3);
  });
});

describe("computeIndicators 边界 + sanity", () => {
  it("无 items + 无 activities → 排名仍出 N 行,各项均 80 (因为全等)", () => {
    const districts = ["甲", "乙", "丙"];
    const result = computeIndicators(districts, [], []);
    expect(result.ranked).toHaveLength(3);
    // 全等数据应该全部区间化到 80,综合分都相同
    expect(result.stats.span).toBeCloseTo(0, 5);
    for (const r of result.ranked) {
      expect(r.composite).toBeCloseTo(80, 5);
    }
  });

  it("超出 topicIdx 范围的 item 不计入 topicCounts", () => {
    const districts = ["甲"];
    const items: ComputeItem[] = [
      // topicIdx = 99 越界
      {
        itemId: "i1",
        districtName: "甲",
        tier: "central",
        topicIdx: 99,
        publishedDate: "2025-01-01",
      },
      // topicIdx = -1 越界
      {
        itemId: "i2",
        districtName: "甲",
        tier: "central",
        topicIdx: -1,
        publishedDate: "2025-01-02",
      },
    ];
    const result = computeIndicators(districts, items, []);
    // 越界主题不进 topicCounts,但 item count + days 仍计
    expect(result.rawMedia["甲"]!.central.count).toBe(2);
    expect(result.rawMedia["甲"]!.central.topicCounts.every((c) => c === 0)).toBe(true);
  });

  it("districtName 不在区县列表里的 item 被丢弃", () => {
    const districts = ["甲"];
    const items: ComputeItem[] = [
      {
        itemId: "i1",
        districtName: "乙",
        tier: "central",
        topicIdx: 0,
        publishedDate: "2025-01-01",
      },
    ];
    const result = computeIndicators(districts, items, []);
    expect(result.rawMedia["甲"]!.central.count).toBe(0);
  });

  it("activity 在 districts 列表外的被忽略", () => {
    const districts = ["甲"];
    const activities: ActivityDataPoint[] = [
      {
        district: "甲",
        themes: { a: 1 },
        total: 1,
        firstDate: "2025-01-01",
        lastDate: "2025-01-01",
        spanDays: 1,
        freq: 1,
      },
      {
        district: "乙",
        themes: { a: 99 },
        total: 99,
        firstDate: "2025-01-01",
        lastDate: "2025-01-01",
        spanDays: 1,
        freq: 99,
      },
    ];
    const result = computeIndicators(districts, [], activities);
    expect(result.rawPublic["甲"]!.count).toBe(1);
    expect(result.rawPublic["乙"]).toBeUndefined();
  });
});
