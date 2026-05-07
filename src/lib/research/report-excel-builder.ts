// src/lib/research/report-excel-builder.ts
//
// A5 Phase 7 — Excel 报告 5-sheet 程式构建（@e965/xlsx）
//
// Spec ref: docs/superpowers/specs/2026-05-07-a5-report-export-design.md §5.3
// Plan ref: docs/superpowers/plans/2026-05-07-a5-report-export-plan.md Phase 7 Task 7.1
//
// 5 sheet 结构（spec §5.3）：
//   1. 明细                 — 11 列：序号 / 标题 / 媒体名 / 媒体分级 / 区域 /
//                              命中区县 / 命中主题 / 发布时间 / 采集时间 / 原文 URL / 内容类型
//                              （命中区县 / 命中主题用 顿号「、」 折叠多值，per Phase 6 B-1 协议）
//   2. 分主题透视           — 5 列：主题名 / 报道数 / 占比% / Top3 区县 / Top3 媒体
//   3. 分区县透视           — 4 列：区县名 / 报道数 / 占比% / Top3 主题
//                              （仅列报道数 ≥ 1，由聚合层已 filter）
//   4. 分媒体层级透视       — 4 列：层级 / 报道数 / 占比% / Top3 媒体
//                              （包含"未分类"层级，由聚合层产出）
//   5. 图表数据             — 多 block 拼接（Block A 时间趋势 / B 主题分布 / C 区县分布）
//                              客户能直接选 Block 区域做趋势图/饼图
//
// V1 不做：
//   - 列宽 autofit（Excel 客户端 Ctrl+A → 双击列分隔自动 fit，简化实现）
//   - cell style（header 加粗 + 灰底）— Excel 默认渲染足够清晰，V2 再加
//   - URL hyperlink — V1 用纯文本，避免 hyperlink XML 复杂度

import * as XLSX from "@e965/xlsx";

import type { AggregatesJson } from "@/db/schema/research/reports";

/**
 * 单条附录行（明细 sheet 用）。
 *
 * 多区县/多主题已在 Inngest Step 6 join + dedup 折叠为 `string[]`，
 * builder 内 `join("、")` 输出。
 */
export interface ExcelAppendixRow {
  title: string;
  outletName: string | null;
  outletTier: string | null;
  outletRegion: string | null;
  /** 多区县 dedup 后的数组（顺序按聚合返回，不再排序） */
  districtNames: string[];
  /** 多主题 dedup 后的数组 */
  topicNames: string[];
  /** ISO date (yyyy-MM-dd) or null */
  publishedAt: string | null;
  /** ISO date (yyyy-MM-dd) or null */
  firstSeenAt: string | null;
  url: string | null;
  contentType: string;
}

export interface ExcelBuildInput {
  aggregates: AggregatesJson;
  appendix: ExcelAppendixRow[];
}

/**
 * 构建 .xlsx Buffer。
 *
 * 用 `aoa_to_sheet`（array-of-arrays）拼每个 sheet：
 *  - 第一行 = header（中文列名）
 *  - 后续行 = 数据；数字直接用 number type；占比保留 1 位小数（toFixed(1) 文本）
 *
 * Sheet 5 用 `aoa_to_sheet` 多 block 拼接（用空行分隔 Block A/B/C）。
 *
 * 失败抛 Error，由 Inngest 自动 retry 3 次（per spec §4.2 表）。
 */
export function buildReportXlsx(input: ExcelBuildInput): Buffer {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: 明细 (11 列) ───────────────────────────────────────────
  const detailRows: (string | number)[][] = [
    [
      "序号",
      "标题",
      "媒体名",
      "媒体分级",
      "区域",
      "命中区县",
      "命中主题",
      "发布时间",
      "采集时间",
      "原文 URL",
      "内容类型",
    ],
    ...input.appendix.map((r, i) => [
      i + 1,
      r.title || "(无标题)",
      r.outletName ?? "未分类",
      r.outletTier ?? "未分类",
      r.outletRegion ?? "—",
      r.districtNames.join("、") || "—",
      r.topicNames.join("、") || "—",
      r.publishedAt ?? "—",
      r.firstSeenAt ?? "—",
      r.url ?? "—",
      r.contentType,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(detailRows),
    "明细",
  );

  // ── Sheet 2: 分主题透视 (5 列) ──────────────────────────────────────
  const topicRows: (string | number)[][] = [
    ["主题名", "报道数", "占比%", "Top3 区县", "Top3 媒体"],
    ...input.aggregates.topicDistribution.map((t) => [
      t.topicName,
      t.count,
      t.percentage.toFixed(1),
      t.topDistricts.slice(0, 3).join("、") || "—",
      t.topMedia.slice(0, 3).join("、") || "—",
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(topicRows),
    "分主题透视",
  );

  // ── Sheet 3: 分区县透视 (4 列) ──────────────────────────────────────
  // 聚合层已 filter（仅 count ≥ 1），builder 不再过滤
  const districtRows: (string | number)[][] = [
    ["区县名", "报道数", "占比%", "Top3 主题"],
    ...input.aggregates.districtDistribution.map((d) => [
      d.districtName,
      d.count,
      d.percentage.toFixed(1),
      d.topTopics.slice(0, 3).join("、") || "—",
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(districtRows),
    "分区县透视",
  );

  // ── Sheet 4: 分媒体层级透视 (4 列) ──────────────────────────────────
  // 包含"未分类"层级（由聚合层产出）
  const tierRows: (string | number)[][] = [
    ["层级", "报道数", "占比%", "Top3 媒体"],
    ...input.aggregates.mediaTierDistribution.map((m) => [
      m.tier,
      m.count,
      m.percentage.toFixed(1),
      m.topMediaNames.slice(0, 3).join("、") || "—",
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(tierRows),
    "分媒体层级透视",
  );

  // ── Sheet 5: 图表数据（多 block） ───────────────────────────────────
  // 用 aoa_to_sheet 一次性生成；Block 间空行分隔；每 Block header 行 + 数据行
  const chartRows: (string | number)[][] = [
    ["Block A — 时间趋势"],
    ["日期", "报道数", "累计"],
    ...input.aggregates.dailyTrend.map((d) => [d.date, d.count, d.cumulative]),
    [""],
    ["Block B — 主题分布"],
    ["主题", "数量"],
    ...input.aggregates.topicDistribution.map((t) => [t.topicName, t.count]),
    [""],
    ["Block C — 区县分布"],
    ["区县", "数量"],
    ...input.aggregates.districtDistribution.map((d) => [
      d.districtName,
      d.count,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(chartRows),
    "图表数据",
  );

  // ── Write Buffer ────────────────────────────────────────────────────
  // @e965/xlsx 在 Node 环境下 type:"buffer" 返 Buffer；保险用 Buffer.from 兜底转换。
  const out = XLSX.write(wb, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}
