import { describe, it, expect } from "vitest";
import type {
  ReportSearchSnapshot,
  AggregatesJson,
  AdvancedSearchSnapshot,
  EcologicalIndexSnapshot,
  AdvancedSearchAggregates,
  EcologicalIndexAggregates,
} from "../reports";

describe("Report schema union types", () => {
  it("ReportSearchSnapshot 接受 advanced_search 类型", () => {
    const snap: ReportSearchSnapshot = {
      kind: "advanced_search",
      conditions: [],
      sidebarFilter: {} as never,
      hitItemIds: [],
      capturedAt: "2025-05-26",
    };
    expect(snap.kind).toBe("advanced_search");
    if (snap.kind === "advanced_search") {
      const narrowed: AdvancedSearchSnapshot = snap;
      expect(narrowed.hitItemIds).toEqual([]);
    }
  });

  it("ReportSearchSnapshot 接受 ecological_index 类型", () => {
    const snap: ReportSearchSnapshot = {
      kind: "ecological_index",
      scopeId: "scope-1",
      activityDatasetId: "ds-1",
      year: 2025,
      windowStart: "2025-01-01",
      windowEnd: "2026-01-01",
      includeContentSource: true,
      capturedAt: "2025-05-26",
    };
    expect(snap.kind).toBe("ecological_index");
    if (snap.kind === "ecological_index") {
      const narrowed: EcologicalIndexSnapshot = snap;
      expect(narrowed.year).toBe(2025);
      expect(narrowed.includeContentSource).toBe(true);
    }
  });

  it("AggregatesJson 接受 advanced_search 类型(老数据无 kind 字段也兼容)", () => {
    const agg: AggregatesJson = {
      mediaTierDistribution: [],
      districtDistribution: [],
      topicDistribution: [],
      dailyTrend: [],
      hitCount: 0,
      isAiFallback: false,
      generatedAt: "2025-05-26",
    };
    expect(agg).toBeDefined();
    // 当 kind 缺失时是 AdvancedSearchAggregates
    const narrowed: AdvancedSearchAggregates = agg as AdvancedSearchAggregates;
    expect(narrowed.hitCount).toBe(0);
  });

  it("AggregatesJson 接受 ecological_index 类型", () => {
    const agg: AggregatesJson = {
      kind: "ecological_index",
      ranked: [],
      rawMedia: {},
      rawPublic: {},
      scaledMedia: {},
      scaledPublic: {},
      stats: {
        max: 0,
        min: 0,
        span: 0,
        mean: 0,
        median: 0,
        stdev: 0,
        tier_high: 0,
        tier_mid: 0,
        tier_low: 0,
      },
      generatedAt: "2025-05-26",
    };
    expect(agg.kind).toBe("ecological_index");
    if (agg.kind === "ecological_index") {
      const narrowed: EcologicalIndexAggregates = agg;
      expect(narrowed.ranked).toEqual([]);
    }
  });
});
