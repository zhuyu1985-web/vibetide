"use client";

/**
 * ToolActionCard — chat 内 tool 调用结果的快速操作卡片。
 *
 * 当前支持：
 * - research_query_builder（A6 Phase 3）：展示拆条件 + "一键填入 A4 高级检索"
 * - data_pivoter（A6 Phase 4）：展示透视配置 + chart 类型 + reasoning + "在报告页应用此透视"
 *
 * 遵循 CLAUDE.md 设计系统：变量按钮（variant="ghost"）无边框 + 中文 UI + GlassCard。
 */

import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import type { ResearchQueryBuilderResult } from "@/lib/agent/skills/research-query-builder";
import type { DataPivoterResult } from "@/lib/agent/skills/data-pivoter";

const FIELD_LABELS: Record<string, string> = {
  title: "标题",
  content: "正文",
  author: "作者",
  outletName: "媒体",
  outletTier: "媒体分级",
  outletRegion: "媒体区域",
  district: "报道区县",
  topic: "主题",
  contentType: "内容类型",
  publishedAt: "发布时间",
  platform: "平台",
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: "含",
  not_contains: "不含",
  equals: "=",
  not_equals: "≠",
  between: "在",
};

// data_pivoter 维度 + chart_type + measure 的中文显示
const DIMENSION_LABELS: Record<string, string> = {
  topic: "主题",
  district: "区县",
  media_tier: "媒体分级",
  media_name: "媒体名",
  date: "时间",
};

const MEASURE_LABELS: Record<string, string> = {
  count: "数量",
  percentage: "占比",
  avg_tier: "平均媒体分级",
};

const CHART_TYPE_LABELS: Record<string, string> = {
  bar: "柱状图",
  heatmap: "热力图",
  donut: "环形图",
  line: "折线图",
};

type ToolName = "research_query_builder" | "data_pivoter";

interface ToolActionCardProps {
  toolName: ToolName;
  toolResult: ResearchQueryBuilderResult | DataPivoterResult;
}

export function ToolActionCard({ toolName, toolResult }: ToolActionCardProps) {
  const router = useRouter();

  if (toolName === "research_query_builder") {
    const r = toolResult as ResearchQueryBuilderResult;
    return (
      <GlassCard className="p-4">
        <p className="text-sm text-muted-foreground">{r.reasoning}</p>
        <ul className="mt-3 space-y-1 text-sm">
          {r.conditions.map((c, i) => {
            const value = Array.isArray(c.value)
              ? c.value.join(" ~ ")
              : c.value;
            return (
              <li key={i}>
                · {FIELD_LABELS[c.field] ?? c.field}{" "}
                {OPERATOR_LABELS[c.operator] ?? c.operator} {value}
                {c.logic === "or" ? " （或）" : ""}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(r.applyUrl)}
          >
            一键填入 A4 高级检索 →
          </Button>
        </div>
      </GlassCard>
    );
  }

  if (toolName === "data_pivoter") {
    const r = toolResult as DataPivoterResult;
    const rowsLabel = DIMENSION_LABELS[r.pivot_config.rows] ?? r.pivot_config.rows;
    const colsLabel = DIMENSION_LABELS[r.pivot_config.cols] ?? r.pivot_config.cols;
    const measureLabel =
      MEASURE_LABELS[r.pivot_config.measure] ?? r.pivot_config.measure;
    const chartLabel = CHART_TYPE_LABELS[r.chart_type] ?? r.chart_type;

    return (
      <GlassCard className="p-4">
        <p className="text-sm text-muted-foreground">{r.reasoning}</p>
        <div className="mt-3 space-y-1 text-sm">
          <div>
            透视维度：
            <span className="font-medium">{rowsLabel}</span>
            <span className="mx-1 text-muted-foreground">×</span>
            <span className="font-medium">{colsLabel}</span>
          </div>
          <div>
            度量：<span className="font-medium">{measureLabel}</span>
          </div>
          <div>
            图表类型：
            <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              {chartLabel}
            </span>
          </div>
          {r.pivot_config.filter && Object.keys(r.pivot_config.filter).length > 0 && (
            <div>
              过滤：
              {Object.entries(r.pivot_config.filter).map(([k, vs], i) => (
                <span key={k}>
                  {i > 0 ? "；" : ""}
                  {DIMENSION_LABELS[k] ?? k}={vs.join(", ")}
                </span>
              ))}
            </div>
          )}
        </div>
        {r.applyUrl && (
          <div className="mt-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(r.applyUrl!)}
            >
              在报告页应用此透视 →
            </Button>
          </div>
        )}
      </GlassCard>
    );
  }

  return null;
}
