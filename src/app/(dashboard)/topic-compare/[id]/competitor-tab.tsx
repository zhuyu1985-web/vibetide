"use client";

import { ExternalLink, Sparkles, Users } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompetitorGroup } from "@/lib/types";

/* ─── Component ─── */

interface Props {
  competitorGroups: CompetitorGroup[];
}

export function CompetitorTab({ competitorGroups }: Props) {
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
              {/* Header */}
              <div className="grid grid-cols-[120px_1fr_100px_100px_100px_140px] gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span>媒体名称</span>
                <span>报道标题</span>
                <span>报道主体</span>
                <span>发布时间</span>
                <span>发布渠道</span>
                <span>操作</span>
              </div>

              {/* Body */}
              {group.outlets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500">
                  <p className="text-sm">该级别暂无数据</p>
                </div>
              ) : (
                group.outlets.flatMap((outlet) =>
                  outlet.articles.map((art, idx) => (
                    <div
                      key={`${outlet.outletName}-${idx}`}
                      className="grid grid-cols-[120px_1fr_100px_100px_100px_140px] gap-2 px-5 py-3.5 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 items-center hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition"
                    >
                      {/* Outlet Name */}
                      <span className="text-sm text-gray-900 dark:text-gray-100 font-medium truncate">
                        {outlet.outletName}
                      </span>

                      {/* Article Title */}
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-normal">
                        {art.title}
                      </span>

                      {/* Subject */}
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {art.subject}
                      </span>

                      {/* Published At */}
                      <span className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                        {art.publishedAt}
                      </span>

                      {/* Channel */}
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {art.channel}
                      </span>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="border-0 text-xs">
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                          AI解读
                        </Button>
                        <a
                          href={art.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition px-2 py-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          查看原文
                        </a>
                      </div>
                    </div>
                  ))
                )
              )}
            </GlassCard>
          </div>
        );
      })}
    </div>
  );
}
