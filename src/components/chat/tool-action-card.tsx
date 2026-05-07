"use client";

/**
 * ToolActionCard — chat 内 tool 调用结果的快速操作卡片。
 *
 * 当前支持：
 * - research_query_builder（A6 Phase 3）：展示拆条件 + "一键填入 A4 高级检索"
 *
 * Phase 4 将扩展：
 * - data_pivoter：透视配置 + chart 类型 + preview + "在报告页应用此透视"
 *
 * 遵循 CLAUDE.md 设计系统：变量按钮（variant="ghost"）无边框 + 中文 UI + GlassCard。
 */

import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";

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

interface ResearchQueryBuilderResult {
  conditions: {
    field: string;
    operator: string;
    value: string | string[];
    logic: "and" | "or";
  }[];
  sidebarFilter?: { districtIds?: string[]; topicIds?: string[] } | null;
  reasoning: string;
  applyUrl: string;
}

type ToolName = "research_query_builder";

interface ToolActionCardProps {
  toolName: ToolName;
  toolResult: ResearchQueryBuilderResult;
}

export function ToolActionCard({ toolName, toolResult }: ToolActionCardProps) {
  const router = useRouter();

  if (toolName === "research_query_builder") {
    const r = toolResult;
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

  return null;
}
