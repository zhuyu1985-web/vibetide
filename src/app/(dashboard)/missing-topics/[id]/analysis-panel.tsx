"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MissingTopicDetail } from "@/lib/types";

/* ─── Mock analysis content ─── */

const mockSections = {
  central:
    "3家央级媒体已报道。人民日报侧重政策解读，新华社聚焦行业影响，央视做了专家访谈...",
  other:
    "澎湃新闻从法律视角分析；第一财经关注对科技企业的合规成本影响...",
  highlights:
    "第一财经独家获取企业合规成本测算数据...",
  summary:
    "热度持续上升，央级媒体全面跟进，建议立即补报...",
  angle1: "本地科技企业合规影响 — 结合本地AI企业采访",
  angle2: "专家解读白皮书亮点 — 邀请本地高校AI专家",
  risk: "白皮书全文尚未公开，部分细节需核实后发布",
};

/* ─── Collapsible section ─── */

function Section({
  tag,
  tagColor,
  title,
  children,
  defaultOpen = true,
  cardClassName = "",
}: {
  tag: string;
  tagColor: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  cardClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-lg border border-gray-100 dark:border-gray-700/60 ${cardClassName}`}
    >
      <button
        type="button"
        className="flex items-center gap-2 w-full px-4 py-3 text-left border-0 bg-transparent"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        )}
        <Badge className={`border-0 text-[11px] ${tagColor}`}>{tag}</Badge>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Component ─── */

interface Props {
  detail: MissingTopicDetail;
}

export function AnalysisPanel({ detail }: Props) {
  void detail; // detail available for future dynamic content

  return (
    <GlassCard padding="lg" className="bg-gray-50/50 dark:bg-gray-900/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          AI 全网报道分析
        </p>
        <Button
          size="sm"
          className="border-0 bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => {
            // TODO: trigger AI analysis
          }}
        >
          一键AI检索全网报道
        </Button>
      </div>

      {/* Collapsible sections */}
      <div className="flex flex-col gap-3">
        {/* 1. Central media */}
        <Section
          tag="央级媒体"
          tagColor="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          title="官媒报道分析"
        >
          {mockSections.central}
        </Section>

        {/* 2. Other media */}
        <Section
          tag="其他"
          tagColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          title="其他媒体分析"
        >
          {mockSections.other}
        </Section>

        {/* 3. Highlights */}
        <Section
          tag="亮点"
          tagColor="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          title="报道亮点"
        >
          {mockSections.highlights}
        </Section>

        {/* 4. Summary */}
        <Section
          tag="总结"
          tagColor="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          title="整体总结"
        >
          {mockSections.summary}
        </Section>

        {/* 5. Supplement reporting suggestion */}
        <Section
          tag="📝 补报"
          tagColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          title="补充报道建议"
          cardClassName="bg-blue-50/50 dark:bg-blue-950/20"
        >
          <div className="space-y-3">
            {/* Timing */}
            <p>
              <span className="text-red-600 dark:text-red-400 font-bold">
                ⏰ 建议：立即报道
              </span>
              <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs">
                最佳报道窗口为事件发生后2小时内
              </span>
            </p>

            {/* Suggested angles */}
            <div>
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                建议角度：
              </p>
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2 bg-white dark:bg-gray-800/60 rounded-lg p-3">
                  <div>
                    <span className="text-gray-700 dark:text-gray-300">
                      1. {mockSections.angle1}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border-0 text-blue-600 dark:text-blue-400 shrink-0"
                    onClick={() => {
                      // TODO: copy as topic
                    }}
                  >
                    📋 复制为选题
                  </Button>
                </div>
                <div className="flex items-start justify-between gap-2 bg-white dark:bg-gray-800/60 rounded-lg p-3">
                  <div>
                    <span className="text-gray-700 dark:text-gray-300">
                      2. {mockSections.angle2}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="border-0 text-blue-600 dark:text-blue-400 shrink-0"
                    onClick={() => {
                      // TODO: copy as topic
                    }}
                  >
                    📋 复制为选题
                  </Button>
                </div>
              </div>
            </div>

            {/* Risk warning */}
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
              <p className="text-sm text-red-700 dark:text-red-400">
                ⚠ 风险提示：{mockSections.risk}
              </p>
            </div>
          </div>
        </Section>
      </div>
    </GlassCard>
  );
}
