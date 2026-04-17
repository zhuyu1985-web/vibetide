"use client";

import { useState } from "react";
import {
  ExternalLink,
  Sparkles,
  Users,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompetitorGroup } from "@/lib/types";

/* ─── Helpers ─── */

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

type InterpretState = {
  loading: boolean;
  text?: string;
  error?: string;
  expanded: boolean;
};

/* ─── Component ─── */

interface Props {
  competitorGroups: CompetitorGroup[];
}

export function CompetitorTab({ competitorGroups }: Props) {
  const [interpretations, setInterpretations] = useState<
    Record<string, InterpretState>
  >({});

  const handleInterpret = async (contentId: string | undefined, rowKey: string) => {
    // No content ID (demo data) — surface a clear message
    if (!contentId || !isUUID(contentId)) {
      setInterpretations((s) => ({
        ...s,
        [rowKey]: {
          loading: false,
          error: "演示数据不支持 AI 解读",
          expanded: true,
        },
      }));
      return;
    }

    const current = interpretations[rowKey];
    if (current?.text) {
      setInterpretations((s) => ({
        ...s,
        [rowKey]: { ...current, expanded: !current.expanded },
      }));
      return;
    }
    if (current?.loading) return;

    setInterpretations((s) => ({
      ...s,
      [rowKey]: { loading: true, expanded: true },
    }));

    try {
      const res = await fetch("/api/benchmarking/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "AI 解读失败");
      }
      setInterpretations((s) => ({
        ...s,
        [rowKey]: {
          loading: false,
          text: data.interpretation,
          expanded: true,
        },
      }));
    } catch (err) {
      setInterpretations((s) => ({
        ...s,
        [rowKey]: {
          loading: false,
          error: err instanceof Error ? err.message : "AI 解读失败",
          expanded: true,
        },
      }));
    }
  };

  if (competitorGroups.length === 0) {
    return (
      <GlassCard className="mt-4">
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">暂无竞品媒体对标数据</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="mt-4 space-y-5">
      {competitorGroups.map((group) => {
        const totalArticles = group.outlets.reduce(
          (sum, o) => sum + o.articles.length,
          0
        );

        return (
          <div key={group.level}>
            {/* Section Header */}
            <div
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-t-lg border ${group.levelColor}`}
            >
              <Badge className="bg-current/10 text-inherit text-xs border-0">
                {group.levelLabel}
              </Badge>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {group.levelLabel}报道
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                {group.outlets.length} 家媒体 / {totalArticles} 篇报道
              </span>
            </div>

            {/* Table */}
            <GlassCard padding="none" className="rounded-t-none">
              <div className="grid grid-cols-[120px_1fr_100px_100px_100px_140px] gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>媒体名称</span>
                <span>报道标题</span>
                <span>报道主体</span>
                <span>发布时间</span>
                <span>发布渠道</span>
                <span>操作</span>
              </div>

              {group.outlets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                  <p className="text-sm">该级别暂无数据</p>
                </div>
              ) : (
                group.outlets.flatMap((outlet) =>
                  outlet.articles.map((art, idx) => {
                    const rowKey = `${outlet.outletName}-${idx}-${art.title}`;
                    const interp = interpretations[rowKey];
                    const isExpanded = interp?.expanded ?? false;
                    return (
                      <div
                        key={rowKey}
                        className="border-b border-gray-50 dark:border-gray-800/50 last:border-b-0"
                      >
                        <div className="grid grid-cols-[120px_1fr_100px_100px_100px_140px] gap-2 px-5 py-3.5 items-center hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition">
                          <span className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">
                            {outlet.outletName}
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-normal">
                            {art.title}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {art.subject}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                            {art.publishedAt}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {art.channel}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="border-0 text-xs"
                              onClick={() =>
                                handleInterpret(art.contentId, rowKey)
                              }
                              disabled={interp?.loading}
                            >
                              {interp?.loading ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5 mr-1" />
                              )}
                              {interp?.text && isExpanded
                                ? "收起"
                                : interp?.loading
                                ? "解读中"
                                : "AI 解读"}
                              {interp?.text && (
                                <ChevronDown
                                  className={`h-3 w-3 ml-0.5 transition-transform ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              )}
                            </Button>
                            <a
                              href={art.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition px-2 py-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              原文
                            </a>
                          </div>
                        </div>

                        {/* Expandable interpretation */}
                        {isExpanded && interp && (
                          <div className="px-5 pb-3 pt-0.5">
                            <div className="rounded-md bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 px-4 py-3">
                              <div className="flex items-center gap-1.5 mb-2">
                                <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                                  AI 解读
                                </span>
                              </div>
                              {interp.loading && (
                                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  正在生成解读，请稍候...
                                </div>
                              )}
                              {interp.error && (
                                <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  {interp.error}
                                </div>
                              )}
                              {interp.text && (
                                <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                  {interp.text}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )
              )}
            </GlassCard>
          </div>
        );
      })}
    </div>
  );
}
