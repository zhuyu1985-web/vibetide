"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ExternalLink,
  Link2,
  Send,
  Search,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { linkMissedTopicToArticle, pushMissedTopicToExternal } from "@/app/actions/benchmarking";
import { TopicReportPanel } from "./topic-report-panel";
import type { MissedTopic } from "@/lib/types";

// ---------------------------------------------------------------------------
// Source type config
// ---------------------------------------------------------------------------

const sourceTypeConfig: Record<
  string,
  { label: string; className: string }
> = {
  social_hot: {
    label: "社媒热榜",
    className:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700/50",
  },
  sentiment_event: {
    label: "舆情事件",
    className:
      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/50",
  },
  benchmark_media: {
    label: "对标媒体",
    className:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/50",
  },
};

// ---------------------------------------------------------------------------
// Article search result type
// ---------------------------------------------------------------------------

interface ArticleSearchResult {
  id: string;
  title: string;
  publishedAt?: string;
  status: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MissedTopicDetailProps {
  topic: MissedTopic;
  onUpdate: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MissedTopicDetail({ topic, onUpdate }: MissedTopicDetailProps) {
  // Link article dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ArticleSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Push state
  const [isPushing, startPushTransition] = useTransition();
  const [pushError, setPushError] = useState<string | null>(null);

  // Link action state
  const [isLinking, startLinkTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(
        `/api/benchmarking/search-articles?q=${encodeURIComponent(query.trim())}`
      );
      if (!res.ok) throw new Error(`搜索失败 (${res.status})`);
      const data: ArticleSearchResult[] = await res.json();
      setSearchResults(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "搜索出错，请重试");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSelectArticle(articleId: string) {
    startLinkTransition(async () => {
      await linkMissedTopicToArticle(topic.id, articleId);
      setLinkDialogOpen(false);
      setSearchQuery("");
      setSearchResults([]);
      onUpdate();
    });
  }

  function handlePush() {
    setPushError(null);
    startPushTransition(async () => {
      try {
        await pushMissedTopicToExternal(topic.id);
        onUpdate();
      } catch (err) {
        setPushError(err instanceof Error ? err.message : "推送失败，请重试");
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Source type badge
  // ---------------------------------------------------------------------------

  const sourceTypeCfg = topic.sourceType
    ? (sourceTypeConfig[topic.sourceType] ?? null)
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="mt-3 space-y-3">
      {/* Source info row */}
      <GlassCard variant="secondary" padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source type badge */}
          {sourceTypeCfg && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${sourceTypeCfg.className}`}
            >
              {sourceTypeCfg.label}
            </span>
          )}

          {/* Platform */}
          {topic.sourcePlatform && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              来源：{topic.sourcePlatform}
            </span>
          )}

          {/* Source URL link */}
          {topic.sourceUrl && (
            <a
              href={topic.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <ExternalLink size={12} />
              查看原文
            </a>
          )}
        </div>
      </GlassCard>

      {/* Actions row */}
      <GlassCard variant="secondary" padding="sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Link article button / already linked badge */}
          {topic.matchedArticleId ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle size={13} />
              已关联：{topic.matchedArticleTitle ?? topic.matchedArticleId}
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-3 border-0"
              onClick={() => setLinkDialogOpen(true)}
              disabled={isLinking}
            >
              {isLinking ? (
                <Loader2 size={12} className="mr-1.5 animate-spin" />
              ) : (
                <Link2 size={12} className="mr-1.5" />
              )}
              关联自有作品
            </Button>
          )}

          {/* Push button / already pushed state */}
          <div className="flex items-center gap-2">
            {topic.pushedAt ? (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                已推送（
                {new Date(topic.pushedAt).toLocaleString("zh-CN", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                ）
              </span>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-3 border-0"
                onClick={handlePush}
                disabled={isPushing}
              >
                {isPushing ? (
                  <Loader2 size={12} className="mr-1.5 animate-spin" />
                ) : (
                  <Send size={12} className="mr-1.5" />
                )}
                推送至三方
              </Button>
            )}
            {pushError && (
              <span className="text-xs text-red-500 dark:text-red-400">
                {pushError}
              </span>
            )}
          </div>
        </div>
      </GlassCard>

      {/* AI Report */}
      <TopicReportPanel
        topicTitle={topic.title}
        cachedReport={topic.aiSummary}
      />

      {/* Link article dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>关联自有作品</DialogTitle>
            <DialogDescription>
              搜索并选择与「{topic.title}」相关的自有作品，关联后该漏题将标记为已解决。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Search input */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
              />
              <Input
                className="pl-9 text-sm border-0 ring-1 ring-gray-200 dark:ring-gray-700 focus-visible:ring-blue-300"
                placeholder="输入关键词搜索文章..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {/* Search results */}
            <div className="min-h-[120px] max-h-[260px] overflow-y-auto space-y-1">
              {isSearching && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="text-blue-500 animate-spin" />
                </div>
              )}

              {searchError && !isSearching && (
                <p className="text-xs text-red-500 dark:text-red-400 py-2 text-center">
                  {searchError}
                </p>
              )}

              {!isSearching && !searchError && searchResults.length === 0 && searchQuery.trim() && (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-6 text-center">
                  未找到相关文章
                </p>
              )}

              {!isSearching && !searchQuery.trim() && (
                <p className="text-xs text-gray-400 dark:text-gray-500 py-6 text-center">
                  输入关键词开始搜索
                </p>
              )}

              {!isSearching &&
                searchResults.map((article) => (
                  <button
                    key={article.id}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors flex items-start gap-2.5 group"
                    onClick={() => handleSelectArticle(article.id)}
                    disabled={isLinking}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-100 line-clamp-1 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                        {article.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {article.publishedAt && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {new Date(article.publishedAt).toLocaleDateString("zh-CN")}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[9px] py-0">
                          {article.status}
                        </Badge>
                      </div>
                    </div>
                    {isLinking && (
                      <Loader2 size={13} className="animate-spin text-blue-400 mt-0.5 shrink-0" />
                    )}
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
