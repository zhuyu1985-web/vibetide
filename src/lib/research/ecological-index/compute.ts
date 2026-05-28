// src/lib/research/ecological-index/compute.ts
//
// 生态文明传播指数报告 - 核心计算算法
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.2
//
// 输入: items (含 districtId, outletId/tier, publishedAt, topicId) + 区县列表 + 16 主题 + 活动数据
// 输出: 39 区县 × 5 维 × 3 子 = 15 二级指标的原始值 + 区间化值 + 综合分
//
// 注意 tier 命名: scope-parser / matcher 阶段保留 5 个分级
//   (central / industry / municipal / district_rmt / district_gov),
// 而 compute 阶段把 district_rmt + district_gov 合并成 1 个 "district" 分级,
// 因此本文件只认 4 个 media tier。调用方需在 build ComputeItem 时完成归并。

import type { ActivityDataPoint } from "@/db/schema/research/activity-datasets";

// ============ 常量 ============

export const TIER_WEIGHT = {
  central: 0.45,
  industry: 0.25,
  municipal: 0.15,
  district: 0.08,
  public: 0.07,
} as const;

export const SUB_WEIGHT = {
  count: 0.40,
  richness: 0.30,
  freq: 0.30,
} as const;

export const SCALE_RANGE: readonly [number, number] = [65, 95] as const;

export const MEDIA_TIERS = ["central", "industry", "municipal", "district"] as const;
export type MediaTier = (typeof MEDIA_TIERS)[number];

// ============ 工具函数 ============

/**
 * 主题丰富度 F = 1 / Σ |p_t − 1/N|
 * counts[i] = 第 i 个主题的命中数; N = 主题维度数(媒体类 16, 公众类 5)
 * - total === 0 时 F = 0
 * - 完全均匀(sumDev === 0)时 F = N(理论上限)
 */
export function richnessF(counts: number[], N: number): number {
  if (counts.length === 0) return 0;
  const total = counts.reduce((s, x) => s + x, 0);
  if (total === 0) return 0;
  let sumDev = 0;
  for (let i = 0; i < N; i += 1) {
    const p = (counts[i] ?? 0) / total;
    sumDev += Math.abs(p - 1 / N);
  }
  if (sumDev === 0) return N;
  return 1 / sumDev;
}

/**
 * min-max 区间化到 [65, 95]
 * - 空数组 → 空数组
 * - 所有值相等 → 全 80 (区间中位数)
 */
export function scaleToRange(values: number[]): number[] {
  if (values.length === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return values.map(() => (SCALE_RANGE[0] + SCALE_RANGE[1]) / 2);
  return values.map(
    (v) => SCALE_RANGE[0] + ((v - lo) / (hi - lo)) * (SCALE_RANGE[1] - SCALE_RANGE[0]),
  );
}

/**
 * 区县归并: 江北区/渝北区 → 两江新区
 * Spec §5.3
 */
export function normalizeDistrict(name: string): string {
  if (name === "江北区" || name === "渝北区") return "两江新区";
  return name;
}

// ============ 类型定义 ============

/**
 * 一条 collected_item 的最小信息(供 compute 用)
 */
export type ComputeItem = {
  itemId: string;
  districtName: string; // 标准 39 区县(已归并)
  tier: MediaTier; // 对应媒体一级 tier (4 个之一)
  topicIdx: number; // 0-15 (16 主题之一)
  publishedDate: string; // ISO YYYY-MM-DD
};

/**
 * 单 (district, tier) 桶的原始值
 */
export type RawTri = {
  count: number; // COUNT(DISTINCT itemId)
  richness: number; // F 原始值
  freq: number; // count / days
  topicCounts: number[]; // 16 个主题各的命中数
  days: number; // COUNT(DISTINCT publishedDate)
};

/**
 * 单 (district) 公众类原始值
 */
export type RawPublic = {
  count: number; // 活动总数
  richness: number; // 5 主题丰富度
  freq: number; // count / spanDays
  themes: Record<string, number>;
  firstDate: string | null;
  lastDate: string | null;
  spanDays: number | null;
};

/**
 * 区间化后的三元组
 */
export type ScaledTri = {
  count: number;
  richness: number;
  freq: number;
};

/**
 * 一个区县的 5 维一级 + 综合分
 */
export type FinalScore = {
  name: string;
  central: number;
  industry: number;
  municipal: number;
  district: number;
  public: number;
  composite: number;
};

/**
 * 整体计算结果
 */
export type ComputeResult = {
  ranked: Array<{ rank: number } & FinalScore>;
  rawMedia: Record<string, Record<MediaTier, RawTri>>;
  rawPublic: Record<string, RawPublic>;
  scaledMedia: Record<string, Record<MediaTier, ScaledTri>>;
  scaledPublic: Record<string, ScaledTri>;
  stats: {
    max: number;
    min: number;
    span: number;
    mean: number;
    median: number;
    stdev: number;
    tier_high: number;
    tier_mid: number;
    tier_low: number;
  };
};

// ============ 主函数 ============

/**
 * 核心计算入口
 *
 * @param districts          标准 39 区县名(已归并) - 决定输出顺序
 * @param items              在 outlet 白名单内的 collected_items (已聚合 district/tier/topic)
 * @param activities         39 区县活动数据(districtName 顺序无关)
 * @param topicN             媒体类主题数(默认 16)
 * @param activityN          公众类主题数(默认 5)
 *
 * 返回 ComputeResult,可直接序列化给 xlsx-builder / docx-builder / chart-generator 用
 */
export function computeIndicators(
  districts: string[],
  items: ComputeItem[],
  activities: ActivityDataPoint[],
  topicN = 16,
  activityN = 5,
): ComputeResult {
  // ── Step 1: 按 (districtName, tier) 分桶
  type Bucket = { items: Set<string>; topicCounts: number[]; days: Set<string> };
  const empty = (): Bucket => ({
    items: new Set(),
    topicCounts: Array(topicN).fill(0),
    days: new Set(),
  });

  const buckets: Record<string, Record<MediaTier, Bucket>> = {};
  for (const d of districts) {
    buckets[d] = {
      central: empty(),
      industry: empty(),
      municipal: empty(),
      district: empty(),
    };
  }

  for (const it of items) {
    const districtNorm = normalizeDistrict(it.districtName);
    const b = buckets[districtNorm]?.[it.tier];
    if (!b) continue;
    b.items.add(it.itemId);
    if (it.topicIdx >= 0 && it.topicIdx < topicN) {
      b.topicCounts[it.topicIdx] = (b.topicCounts[it.topicIdx] ?? 0) + 1;
    }
    b.days.add(it.publishedDate);
  }

  // ── Step 2: 计算 rawMedia (4 tier × 3 子指标 × 39 区县)
  const rawMedia: Record<string, Record<MediaTier, RawTri>> = {};
  for (const d of districts) {
    rawMedia[d] = {} as Record<MediaTier, RawTri>;
    for (const tier of MEDIA_TIERS) {
      const b = buckets[d]![tier];
      const count = b.items.size;
      const days = b.days.size;
      const richness = richnessF(b.topicCounts, topicN);
      const freq = days > 0 ? count / days : 0;
      rawMedia[d]![tier] = {
        count,
        richness,
        freq,
        topicCounts: [...b.topicCounts],
        days,
      };
    }
  }

  // ── Step 3: 计算 rawPublic (1 tier × 3 子指标 × 39 区县)
  const activityMap = new Map(activities.map((a) => [a.district, a]));
  const rawPublic: Record<string, RawPublic> = {};
  for (const d of districts) {
    const a = activityMap.get(d);
    if (a) {
      const themeCounts = Object.values(a.themes);
      const richness = richnessF(themeCounts, activityN);
      rawPublic[d] = {
        count: a.total,
        richness,
        freq: a.freq,
        themes: a.themes,
        firstDate: a.firstDate,
        lastDate: a.lastDate,
        spanDays: a.spanDays,
      };
    } else {
      rawPublic[d] = {
        count: 0,
        richness: 0,
        freq: 0,
        themes: {},
        firstDate: null,
        lastDate: null,
        spanDays: null,
      };
    }
  }

  // ── Step 4: 区间化 [65, 95] (每个二级在 39 区县间独立)
  const scaledMedia: Record<string, Record<MediaTier, ScaledTri>> = {};
  for (const d of districts) {
    scaledMedia[d] = {
      central: { count: 0, richness: 0, freq: 0 },
      industry: { count: 0, richness: 0, freq: 0 },
      municipal: { count: 0, richness: 0, freq: 0 },
      district: { count: 0, richness: 0, freq: 0 },
    };
  }
  for (const tier of MEDIA_TIERS) {
    for (const key of ["count", "richness", "freq"] as const) {
      const values = districts.map((d) => rawMedia[d]![tier][key]);
      const scaled = scaleToRange(values);
      for (let i = 0; i < districts.length; i += 1) {
        scaledMedia[districts[i]!]![tier][key] = scaled[i] ?? 0;
      }
    }
  }
  const scaledPublic: Record<string, ScaledTri> = {};
  for (const d of districts) scaledPublic[d] = { count: 0, richness: 0, freq: 0 };
  for (const key of ["count", "richness", "freq"] as const) {
    const values = districts.map((d) => rawPublic[d]![key]);
    const scaled = scaleToRange(values);
    for (let i = 0; i < districts.length; i += 1) {
      scaledPublic[districts[i]!]![key] = scaled[i] ?? 0;
    }
  }

  // ── Step 5: 一级 + 综合分
  const finals: FinalScore[] = districts.map((d) => {
    const m = scaledMedia[d]!;
    const p = scaledPublic[d]!;
    const central =
      m.central.count * SUB_WEIGHT.count +
      m.central.richness * SUB_WEIGHT.richness +
      m.central.freq * SUB_WEIGHT.freq;
    const industry =
      m.industry.count * SUB_WEIGHT.count +
      m.industry.richness * SUB_WEIGHT.richness +
      m.industry.freq * SUB_WEIGHT.freq;
    const municipal =
      m.municipal.count * SUB_WEIGHT.count +
      m.municipal.richness * SUB_WEIGHT.richness +
      m.municipal.freq * SUB_WEIGHT.freq;
    const district =
      m.district.count * SUB_WEIGHT.count +
      m.district.richness * SUB_WEIGHT.richness +
      m.district.freq * SUB_WEIGHT.freq;
    const pub =
      p.count * SUB_WEIGHT.count + p.richness * SUB_WEIGHT.richness + p.freq * SUB_WEIGHT.freq;
    const composite =
      central * TIER_WEIGHT.central +
      industry * TIER_WEIGHT.industry +
      municipal * TIER_WEIGHT.municipal +
      district * TIER_WEIGHT.district +
      pub * TIER_WEIGHT.public;
    return { name: d, central, industry, municipal, district, public: pub, composite };
  });

  // ── Step 6: 排名 + 统计
  const sorted = [...finals].sort((a, b) => b.composite - a.composite);
  const ranked = sorted.map((f, i) => ({ rank: i + 1, ...f }));

  const scores = sorted.map((f) => f.composite);
  const max = scores.length > 0 ? Math.max(...scores) : 0;
  const min = scores.length > 0 ? Math.min(...scores) : 0;
  const mean = scores.length > 0 ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  const sortedAsc = [...scores].sort((a, b) => a - b);
  const median = sortedAsc[Math.floor(scores.length / 2)] ?? 0;
  const variance =
    scores.length > 0 ? scores.reduce((s, x) => s + (x - mean) ** 2, 0) / scores.length : 0;
  const stdev = Math.sqrt(variance);

  return {
    ranked,
    rawMedia,
    rawPublic,
    scaledMedia,
    scaledPublic,
    stats: {
      max,
      min,
      span: max - min,
      mean,
      median,
      stdev,
      tier_high: scores.filter((s) => s >= 80).length,
      tier_mid: scores.filter((s) => s >= 72 && s < 80).length,
      tier_low: scores.filter((s) => s < 72).length,
    },
  };
}
