// src/lib/research/report-template.ts
//
// A5 Phase 3 — 数据简报模板插值（确定性，不调 LLM）
//
// 生成"数据简报" plain text 草稿（约 200 字），所有具体数字用模板插值，
// 后续给小研做学术润色（保留所有数字）。
//
// Spec ref: docs/superpowers/specs/2026-05-07-a5-report-export-design.md §4.1 Step 2 + §6.4 brief_rewrite 输入
// Plan ref: docs/superpowers/plans/2026-05-07-a5-report-export-plan.md Phase 3 Task 3.1

import type { AggregatesJson } from "@/db/schema/research/reports";

export interface TemplateMeta {
  /** 时间窗起 ISO 字符串（也可 yyyy-mm-dd） */
  timeRangeStart: string;
  /** 时间窗止 ISO 字符串（也可 yyyy-mm-dd） */
  timeRangeEnd: string;
  /** 用户填写的研究主题描述（可选） */
  topicDescription?: string;
  /** 任务/检索覆盖区县总数（含未命中） */
  districtCount: number;
  /** 任务/检索覆盖主题总数（含未命中） */
  topicCount: number;
}

/**
 * 生成"数据简报" plain text。
 *
 * 模板要点：
 *   - 时间窗 + 区域 + 命中数
 *   - Top topic / district / 媒体层级（任一为空时该段省略）
 *   - 单日报道高峰
 *   - 主题描述（可选）
 *
 * 空命中（hitCount=0）走简短无命中模板，不抛错。
 */
export function renderTemplateBrief(
  agg: AggregatesJson,
  meta: TemplateMeta,
): string {
  const start = formatDate(meta.timeRangeStart);
  const end = formatDate(meta.timeRangeEnd);

  // 0 命中兜底
  if (!agg || agg.hitCount === 0) {
    return `在 ${start} 至 ${end} 时间窗内，全网未采集到与所选研究范围（${meta.districtCount} 个区县 / ${meta.topicCount} 个主题）匹配的公开报道。`;
  }

  const parts: string[] = [];

  parts.push(
    `在 ${start} 至 ${end} 时间窗内，全网共采集到与所选研究范围相关的报道 ${agg.hitCount} 条。`,
  );

  const topTopic = agg.topicDistribution[0];
  if (topTopic) {
    parts.push(
      `主题分布上，${topTopic.topicName}最为突出，共 ${topTopic.count} 条（占 ${topTopic.percentage}%）。`,
    );
  }

  const topDistrict = agg.districtDistribution[0];
  if (topDistrict) {
    parts.push(
      `区县分布上，${topDistrict.districtName}报道最多，共 ${topDistrict.count} 条（占 ${topDistrict.percentage}%）。`,
    );
  }

  // 媒体层级 Top 1（按 count 降序，0 计数也算入分布但 Top 取 >0 那个）
  const topTier = pickTopTier(agg);
  if (topTier) {
    parts.push(
      `媒体层级上，${topTier.tier}报道占比 ${topTier.percentage}%（${topTier.count} 条）。`,
    );
  }

  const peak = pickPeakDay(agg);
  if (peak) {
    parts.push(`时间趋势上，单日报道高峰为 ${peak.date}（${peak.count} 条）。`);
  }

  if (meta.topicDescription && meta.topicDescription.trim().length > 0) {
    parts.push(`研究主题为：${meta.topicDescription.trim()}。`);
  }

  return parts.join("");
}

/** ISO 字符串 → yyyy-MM-dd（无效输入原样返回） */
function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 媒体层级取 count 最大且 >0 的；分布全 0 时返 null */
function pickTopTier(agg: AggregatesJson) {
  if (!agg.mediaTierDistribution || agg.mediaTierDistribution.length === 0) {
    return null;
  }
  const sorted = [...agg.mediaTierDistribution].sort((a, b) => b.count - a.count);
  const top = sorted[0];
  if (!top || top.count === 0) return null;
  return top;
}

/** 时间趋势峰值日（多日并列时取最早） */
function pickPeakDay(agg: AggregatesJson) {
  if (!agg.dailyTrend || agg.dailyTrend.length === 0) return null;
  const sorted = [...agg.dailyTrend].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.date.localeCompare(b.date);
  });
  const peak = sorted[0]!;
  if (peak.count === 0) return null;
  return peak;
}
