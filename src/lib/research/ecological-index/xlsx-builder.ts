// src/lib/research/ecological-index/xlsx-builder.ts
//
// 生态文明传播指数报告 - 19-sheet 可验证 xlsx 生成
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §5.4 Step 3
// 移植自 scripts/export-scope-xlsx.py 的 vetted Python 逻辑
//
// 19 个 sheet 结构(顺序固定):
//   00 总览说明 / 01 数据源清单 / 02 数据范围审计   (3 个元数据)
//   1.1-1.3 中央 (数量/丰富度/速度)
//   2.1-2.3 行业
//   3.1-3.3 市级
//   4.1-4.3 区县                                  (15 个二级指标)
//   5.1-5.3 公众(活动)
//   99 综合汇总                                   (1 个综合)
//
// 每个 sheet 顶部含说明行(公式 / 数据源 / 区间化规则),数据区列出原始值与区间化后值,
// 便于人工核对各级权重链路。
//
// 用法:
//   const buf = buildIndexReportXlsx({ result, units, activities });
//   // → 直接 upload 到 Supabase Storage / 写文件 / response 返回

import * as XLSX from "@e965/xlsx";

import type { ActivityDataPoint } from "@/db/schema/research/activity-datasets";

import type { ComputeResult, MediaTier } from "./compute";
import type { ParsedScopeUnit } from "./types";

// ============ 常量 ============

/** 16 个媒体类主题(顺序固定,与体系 docx + compute 阶段一致) */
export const MEDIA_TOPICS: readonly string[] = [
  "美丽中国",
  "综合治理",
  "绿色发展",
  "双碳",
  "和谐共生",
  "长江生态",
  "绿水青山",
  "制度建设",
  "资源节约",
  "污染防治攻坚战",
  "清洁能源",
  "国家公园",
  "环保督察",
  "生物多样性",
  "生态红线",
  "低碳经济",
];

/** 5 个公众类活动主题 */
export const ACTIVITY_THEMES: readonly string[] = [
  "六五环境日",
  "815全国生态日",
  "志愿服务活动",
  "环保设施向公众开放",
  "美丽重庆六进活动",
];

const TIER_LABEL: Record<MediaTier, string> = {
  central: "中央媒体",
  industry: "行业媒体",
  municipal: "市级媒体",
  district: "区县媒体",
};

const TIER_WEIGHT_PCT: Record<MediaTier | "public", string> = {
  central: "45%",
  industry: "25%",
  municipal: "15%",
  district: "8%",
  public: "7%",
};

// ============ Sheet 构建工具 ============

type CellValue = string | number | null;
type Row = CellValue[];

function aoaToSheet(aoa: Row[]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(aoa);
}

// ============ 00 总览说明 ============

function buildOverviewSheet(): XLSX.WorkSheet {
  const aoa: Row[] = [
    ["生态文明传播指数体系 — 总览说明"],
    [""],
    ["【一、5 个一级指标】"],
    ["指标", "权重", "数据源"],
    ["中央媒体传播指数", TIER_WEIGHT_PCT.central, "中央 4 家(央视/人民/光明/新华)"],
    ["行业媒体传播指数", TIER_WEIGHT_PCT.industry, "行业 2 家(中国环境报/美丽重庆)"],
    [
      "市级媒体传播指数",
      TIER_WEIGHT_PCT.municipal,
      "市级 6 家(上游/华龙/视界网/重庆日报/ichongqing/七一网)",
    ],
    [
      "区县媒体传播指数",
      TIER_WEIGHT_PCT.district,
      "区县融媒 41 + 区县政务 41 = 82 家",
    ],
    ["公众行为引导指数", TIER_WEIGHT_PCT.public, "39 区县线下活动统计表"],
    [""],
    ["【二、3 个二级指标(每一级下)】"],
    ["指标", "权重", "说明"],
    ["报道/活动 数量", "40%", "COUNT(DISTINCT item) per (区县, tier)"],
    ["报道/活动 主题丰富度", "30%", "F = 1 / Σ |p_t − 1/N|; N=16(媒体) 或 5(公众)"],
    ["报道/活动 传播速度", "30%", "COUNT / 不同发布日数"],
    [""],
    ["【三、区间化】"],
    ["min-max 区间化到 [65, 95],每个二级指标在 39 区县间独立处理"],
    [""],
    ["【四、综合得分公式】"],
    ["综合 = 中央×0.45 + 行业×0.25 + 市级×0.15 + 区县×0.08 + 公众×0.07"],
    [""],
    ["【五、区县合并】"],
    ["江北区 / 渝北区 → 两江新区(归并为 39 个标准区县口径)"],
  ];
  return aoaToSheet(aoa);
}

// ============ 01 数据源清单 ============

function buildDataSourcesSheet(
  units: ParsedScopeUnit[],
  activities: ActivityDataPoint[],
): XLSX.WorkSheet {
  const aoa: Row[] = [
    ["数据源清单"],
    [""],
    [`【一、媒体名单 (${units.length} 单位)】`],
    ["序号", "媒体名称", "分级", "区县", "公众号"],
  ];
  units.forEach((u, idx) => {
    aoa.push([
      idx + 1,
      u.name,
      u.tier,
      u.districtNormalized ?? u.districtOrig ?? "—",
      u.wechatNames.slice(0, 2).join("、") || "—",
    ]);
  });
  aoa.push([""]);
  aoa.push([`【二、${MEDIA_TOPICS.length} 个媒体类主题词】`]);
  MEDIA_TOPICS.forEach((t, i) => aoa.push([i + 1, t]));
  aoa.push([""]);
  aoa.push([`【三、${ACTIVITY_THEMES.length} 个公众类活动主题】`]);
  ACTIVITY_THEMES.forEach((t, i) => aoa.push([i + 1, t]));
  aoa.push([""]);
  aoa.push([`【四、活动数据集 (${activities.length} 区县)】`]);
  aoa.push(["区县", "活动总数", "首发日", "末发日", "跨度天", "频率(场/天)"]);
  activities.forEach((a) => {
    aoa.push([
      a.district,
      a.total,
      a.firstDate,
      a.lastDate,
      a.spanDays,
      Number(a.freq.toFixed(4)),
    ]);
  });
  return aoaToSheet(aoa);
}

// ============ 02 数据范围审计 ============

function buildAuditSheet(result: ComputeResult): XLSX.WorkSheet {
  const aoa: Row[] = [
    ["数据范围审计"],
    [""],
    ["统计项", "数值"],
    ["区县数", result.ranked.length],
    ["最高分", Number(result.stats.max.toFixed(2))],
    ["最低分", Number(result.stats.min.toFixed(2))],
    ["分差", Number(result.stats.span.toFixed(2))],
    ["平均", Number(result.stats.mean.toFixed(2))],
    ["中位数", Number(result.stats.median.toFixed(2))],
    ["标准差", Number(result.stats.stdev.toFixed(2))],
    ["高分等级(≥80) 数量", result.stats.tier_high],
    ["中分等级(72-80) 数量", result.stats.tier_mid],
    ["低分等级(<72) 数量", result.stats.tier_low],
    [""],
    ["【按 tier 看每区县 items 数】(供反查)"],
    ["区县", "中央 items", "行业 items", "市级 items", "区县 items"],
  ];
  for (const d of result.ranked) {
    const r = result.rawMedia[d.name];
    if (r) {
      aoa.push([
        d.name,
        r.central.count,
        r.industry.count,
        r.municipal.count,
        r.district.count,
      ]);
    }
  }
  return aoaToSheet(aoa);
}

// ============ 媒体类 3 子 sheet(通用) ============

function buildMediaCountSheet(
  tier: MediaTier,
  result: ComputeResult,
): XLSX.WorkSheet {
  const tierLabel = TIER_LABEL[tier];
  const aoa: Row[] = [
    [`${tierLabel} - 报道数量 (二级权重 40%)`],
    [""],
    ["【说明】 在该 tier 下,每个区县的报道总数 = COUNT(DISTINCT item)"],
    ["【数据源】 collected_items × outlet_id(归属本 tier) × research_collected_item_districts"],
    ["【过滤】 published_at ∈ [year-01-01, year+1-01-01)"],
    ["【区间化】 min-max → [65, 95]"],
    ["【公式】 数量得分 = scale(count, 39 区县间 min-max)"],
    [""],
    ["排名", "区县", "报道总数", "区间化得分"],
  ];
  const rows = result.ranked
    .map((r) => ({
      name: r.name,
      count: result.rawMedia[r.name]?.[tier].count ?? 0,
      scaled: result.scaledMedia[r.name]?.[tier].count ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
  rows.forEach((r, i) => {
    aoa.push([i + 1, r.name, r.count, Number(r.scaled.toFixed(2))]);
  });
  return aoaToSheet(aoa);
}

function buildMediaRichnessSheet(
  tier: MediaTier,
  result: ComputeResult,
): XLSX.WorkSheet {
  const tierLabel = TIER_LABEL[tier];
  const N = MEDIA_TOPICS.length; // 16
  const aoa: Row[] = [
    [`${tierLabel} - 主题丰富度 (二级权重 30%)`],
    [""],
    [`【说明】 F = 1 / Σ |p_t − 1/N|, N = ${N} (媒体主题数)`],
    ["【公式】 p_t = topic_count_t / total; F 值越大越均匀; F=N 表示完全均匀"],
    ["【区间化】 min-max → [65, 95]"],
    [""],
    [
      "排名",
      "区县",
      ...MEDIA_TOPICS, // 16 主题计数列
      "总数",
      "F 原始值",
      "区间化得分",
    ],
  ];
  const rows = result.ranked
    .map((r) => {
      const tc = result.rawMedia[r.name]?.[tier].topicCounts ?? Array(N).fill(0);
      const total = result.rawMedia[r.name]?.[tier].count ?? 0;
      const f = result.rawMedia[r.name]?.[tier].richness ?? 0;
      const scaled = result.scaledMedia[r.name]?.[tier].richness ?? 0;
      return { name: r.name, tc, total, f, scaled };
    })
    .sort((a, b) => b.f - a.f);
  rows.forEach((r, i) => {
    aoa.push([
      i + 1,
      r.name,
      ...r.tc,
      r.total,
      Number(r.f.toFixed(4)),
      Number(r.scaled.toFixed(2)),
    ]);
  });
  return aoaToSheet(aoa);
}

function buildMediaFreqSheet(
  tier: MediaTier,
  result: ComputeResult,
): XLSX.WorkSheet {
  const tierLabel = TIER_LABEL[tier];
  const aoa: Row[] = [
    [`${tierLabel} - 传播速度 (二级权重 30%)`],
    [""],
    ["【说明】 freq = count / 不同发布日数"],
    ["【公式】 days = COUNT(DISTINCT to_char(published_at, 'YYYY-MM-DD'))"],
    ["【区间化】 min-max → [65, 95]"],
    [""],
    ["排名", "区县", "报道总数", "发布天数", "速度 (篇/天)", "区间化得分"],
  ];
  const rows = result.ranked
    .map((r) => {
      const m = result.rawMedia[r.name]?.[tier];
      return {
        name: r.name,
        count: m?.count ?? 0,
        days: m?.days ?? 0,
        freq: m?.freq ?? 0,
        scaled: result.scaledMedia[r.name]?.[tier].freq ?? 0,
      };
    })
    .sort((a, b) => b.freq - a.freq);
  rows.forEach((r, i) => {
    aoa.push([
      i + 1,
      r.name,
      r.count,
      r.days,
      Number(r.freq.toFixed(4)),
      Number(r.scaled.toFixed(2)),
    ]);
  });
  return aoaToSheet(aoa);
}

// ============ 公众类 3 sheet ============

function buildPublicCountSheet(result: ComputeResult): XLSX.WorkSheet {
  const aoa: Row[] = [
    ["公众行为引导 - 活动数量 (二级权重 40%)"],
    [""],
    [`【说明】 每个区县的活动总数 (${ACTIVITY_THEMES.length} 类活动场数之和)`],
    [""],
    ["排名", "区县", ...ACTIVITY_THEMES, "活动总数", "区间化得分"],
  ];
  const rows = result.ranked
    .map((r) => {
      const p = result.rawPublic[r.name];
      const themeArr = ACTIVITY_THEMES.map((t) => p?.themes[t] ?? 0);
      return {
        name: r.name,
        themes: themeArr,
        total: p?.count ?? 0,
        scaled: result.scaledPublic[r.name]?.count ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);
  rows.forEach((r, i) => {
    aoa.push([
      i + 1,
      r.name,
      ...r.themes,
      r.total,
      Number(r.scaled.toFixed(2)),
    ]);
  });
  return aoaToSheet(aoa);
}

function buildPublicRichnessSheet(result: ComputeResult): XLSX.WorkSheet {
  const N = ACTIVITY_THEMES.length; // 5
  const aoa: Row[] = [
    ["公众行为引导 - 活动主题丰富度 (二级权重 30%)"],
    [""],
    [`【说明】 F = 1 / Σ |p_t − 1/N|, N = ${N}`],
    [""],
    ["排名", "区县", ...ACTIVITY_THEMES, "总数", "F 原始值", "区间化得分"],
  ];
  const rows = result.ranked
    .map((r) => {
      const p = result.rawPublic[r.name];
      const themeArr = ACTIVITY_THEMES.map((t) => p?.themes[t] ?? 0);
      return {
        name: r.name,
        themes: themeArr,
        total: p?.count ?? 0,
        f: p?.richness ?? 0,
        scaled: result.scaledPublic[r.name]?.richness ?? 0,
      };
    })
    .sort((a, b) => b.f - a.f);
  rows.forEach((r, i) => {
    aoa.push([
      i + 1,
      r.name,
      ...r.themes,
      r.total,
      Number(r.f.toFixed(4)),
      Number(r.scaled.toFixed(2)),
    ]);
  });
  return aoaToSheet(aoa);
}

function buildPublicFreqSheet(result: ComputeResult): XLSX.WorkSheet {
  const aoa: Row[] = [
    ["公众行为引导 - 活动传播速度 (二级权重 30%)"],
    [""],
    ["【说明】 freq = 活动总数 / 跨度天数"],
    [""],
    [
      "排名",
      "区县",
      "活动总数",
      "首发日",
      "末发日",
      "跨度天",
      "速度 (场/天)",
      "区间化得分",
    ],
  ];
  const rows = result.ranked
    .map((r) => {
      const p = result.rawPublic[r.name];
      return {
        name: r.name,
        total: p?.count ?? 0,
        first: p?.firstDate ?? "—",
        last: p?.lastDate ?? "—",
        span: p?.spanDays ?? 0,
        freq: p?.freq ?? 0,
        scaled: result.scaledPublic[r.name]?.freq ?? 0,
      };
    })
    .sort((a, b) => b.freq - a.freq);
  rows.forEach((r, i) => {
    aoa.push([
      i + 1,
      r.name,
      r.total,
      r.first,
      r.last,
      r.span,
      Number(r.freq.toFixed(4)),
      Number(r.scaled.toFixed(2)),
    ]);
  });
  return aoaToSheet(aoa);
}

// ============ 99 综合汇总 ============

function buildCompositeSheet(result: ComputeResult): XLSX.WorkSheet {
  const aoa: Row[] = [
    ["综合汇总 - 5 维一级 × 权重 → 综合分"],
    [""],
    [
      "【公式】 综合 = 中央×0.45 + 行业×0.25 + 市级×0.15 + 区县×0.08 + 公众×0.07",
    ],
    [""],
    ["排名", "区县", "中央", "行业", "市级", "区县", "公众", "综合"],
  ];
  result.ranked.forEach((r) => {
    aoa.push([
      r.rank,
      r.name,
      Number(r.central.toFixed(2)),
      Number(r.industry.toFixed(2)),
      Number(r.municipal.toFixed(2)),
      Number(r.district.toFixed(2)),
      Number(r.public.toFixed(2)),
      Number(r.composite.toFixed(2)),
    ]);
  });
  return aoaToSheet(aoa);
}

// ============ 主入口 ============

export type XlsxInput = {
  /** compute.ts 输出的完整结果 */
  result: ComputeResult;
  /** 媒体名单单位列表(供 01 数据源清单 sheet) */
  units: ParsedScopeUnit[];
  /** 活动数据数组(供 01 数据源清单 sheet) */
  activities: ActivityDataPoint[];
};

/**
 * 生成 19-sheet 可验证 xlsx Buffer
 *
 * Sheet 顺序固定:
 *   00 总览说明 → 01 数据源清单 → 02 数据范围审计
 *   1.1-1.3 中央 / 2.1-2.3 行业 / 3.1-3.3 市级 / 4.1-4.3 区县 / 5.1-5.3 公众
 *   99 综合汇总
 *
 * @returns 19-sheet xlsx Buffer(zip 头 PK,可直接 upload)
 */
export function buildIndexReportXlsx(input: XlsxInput): Buffer {
  const { result, units, activities } = input;
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildOverviewSheet(), "00 总览说明");
  XLSX.utils.book_append_sheet(
    wb,
    buildDataSourcesSheet(units, activities),
    "01 数据源清单",
  );
  XLSX.utils.book_append_sheet(wb, buildAuditSheet(result), "02 数据范围审计");

  XLSX.utils.book_append_sheet(
    wb,
    buildMediaCountSheet("central", result),
    "1.1 中央数量",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildMediaRichnessSheet("central", result),
    "1.2 中央丰富度",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildMediaFreqSheet("central", result),
    "1.3 中央速度",
  );

  XLSX.utils.book_append_sheet(
    wb,
    buildMediaCountSheet("industry", result),
    "2.1 行业数量",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildMediaRichnessSheet("industry", result),
    "2.2 行业丰富度",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildMediaFreqSheet("industry", result),
    "2.3 行业速度",
  );

  XLSX.utils.book_append_sheet(
    wb,
    buildMediaCountSheet("municipal", result),
    "3.1 市级数量",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildMediaRichnessSheet("municipal", result),
    "3.2 市级丰富度",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildMediaFreqSheet("municipal", result),
    "3.3 市级速度",
  );

  XLSX.utils.book_append_sheet(
    wb,
    buildMediaCountSheet("district", result),
    "4.1 区县数量",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildMediaRichnessSheet("district", result),
    "4.2 区县丰富度",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildMediaFreqSheet("district", result),
    "4.3 区县速度",
  );

  XLSX.utils.book_append_sheet(
    wb,
    buildPublicCountSheet(result),
    "5.1 公众数量",
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildPublicRichnessSheet(result),
    "5.2 公众丰富度",
  );
  XLSX.utils.book_append_sheet(wb, buildPublicFreqSheet(result), "5.3 公众速度");

  XLSX.utils.book_append_sheet(wb, buildCompositeSheet(result), "99 综合汇总");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buffer;
}
