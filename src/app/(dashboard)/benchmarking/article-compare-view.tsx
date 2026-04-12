"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink,
  Eye,
  FileText,
  Clock,
  Building2,
} from "lucide-react";
import type {
  BenchmarkAISummary,
  BenchmarkArticleUI,
  PlatformContentUI,
} from "@/lib/types";
import { TopicReportPanel } from "./topic-report-panel";

interface ArticleCompareViewProps {
  ourArticle?: BenchmarkArticleUI;
  competitorContent: PlatformContentUI[];
  topicTitle: string;
}

function formatNumber(n?: number): string {
  if (n === undefined || n === null) return "—";
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

export function ArticleCompareView({
  ourArticle,
  competitorContent,
  topicTitle,
}: ArticleCompareViewProps) {
  const hasSpreadData =
    ourArticle &&
    ourArticle.spreadData &&
    (ourArticle.spreadData.views !== undefined ||
      ourArticle.spreadData.likes !== undefined ||
      ourArticle.spreadData.shares !== undefined ||
      ourArticle.spreadData.comments !== undefined);

  return (
    <div className="space-y-5">
      {/* Two-column comparison grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: 竞品报道 */}
        <GlassCard padding="none">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <Building2 size={15} className="text-gray-500 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              竞品报道
            </h3>
            <Badge variant="secondary" className="text-xs ml-auto">
              {competitorContent.length} 篇
            </Badge>
          </div>

          {competitorContent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Building2 size={22} className="text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                暂无竞品报道数据
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[480px] overflow-y-auto">
              {competitorContent.map((item) => (
                <div key={item.id} className="px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2 flex items-start gap-1"
                  >
                    {item.title}
                    <ExternalLink size={10} className="shrink-0 mt-0.5 text-gray-400" />
                  </a>
                  {item.summary && (
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed mt-1 line-clamp-2">
                      {item.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                    {item.platformName && (
                      <span className="flex items-center gap-1">
                        <Building2 size={10} />
                        {item.platformName}
                      </span>
                    )}
                    {item.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {item.publishedAt}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Right: 我方报道 */}
        <GlassCard padding="none">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
            <FileText size={15} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              我方报道
            </h3>
          </div>

          {!ourArticle ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <FileText size={28} className="text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                我方暂未覆盖此话题
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                竞品已有 {competitorContent.length} 篇报道，建议尽快跟进
              </p>
              <Button
                size="sm"
                className="border-0"
                onClick={() => {
                  const params = new URLSearchParams({
                    topic: topicTitle,
                    source: "benchmarking",
                  });
                  window.location.href = `/super-creation?${params.toString()}`;
                }}
              >
                <FileText size={13} className="mr-1.5" />
                一键创建稿件
              </Button>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-snug">
                    {ourArticle.title}
                  </h4>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px]"
                  >
                    {ourArticle.status}
                  </Badge>
                </div>

                {ourArticle.summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1.5 line-clamp-3">
                    {ourArticle.summary}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 dark:text-gray-500">
                  {ourArticle.categoryName && (
                    <Badge variant="secondary" className="text-[10px] py-0">
                      {ourArticle.categoryName}
                    </Badge>
                  )}
                  {ourArticle.publishedAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {ourArticle.publishedAt}
                    </span>
                  )}
                </div>
              </div>

              {/* Publish channels */}
              {ourArticle.publishChannels && ourArticle.publishChannels.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5">发布渠道</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ourArticle.publishChannels.map((ch, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] py-0">
                        {ch}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Spread data */}
              {hasSpreadData && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  {ourArticle.spreadData.views !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <Eye size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {formatNumber(ourArticle.spreadData.views)} 阅读
                      </span>
                    </div>
                  )}
                  {ourArticle.spreadData.likes !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {formatNumber(ourArticle.spreadData.likes)} 点赞
                      </span>
                    </div>
                  )}
                  {ourArticle.spreadData.shares !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {formatNumber(ourArticle.spreadData.shares)} 分享
                      </span>
                    </div>
                  )}
                  {ourArticle.spreadData.comments !== undefined && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {formatNumber(ourArticle.spreadData.comments)} 评论
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Topic Report Panel below the grid */}
      <TopicReportPanel topicTitle={topicTitle} />
    </div>
  );
}

// Re-export type for consumers that need it alongside this component
export type { BenchmarkAISummary };
