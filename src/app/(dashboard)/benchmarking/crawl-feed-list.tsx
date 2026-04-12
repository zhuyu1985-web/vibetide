"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GlassCard } from "@/components/shared/glass-card";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { PlatformContentUI } from "@/lib/types";

interface CrawlFeedListProps {
  content: PlatformContentUI[];
  hideHeader?: boolean;
}

/** Check if URL points to an actual article (has a path beyond just the domain) */
function isRealArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.length > 1; // more than just "/"
  } catch {
    return false;
  }
}

function formatPublishTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `今天 ${time}`;
  if (isYesterday) return `昨天 ${time}`;
  return `${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")} ${time}`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function getImportanceColor(score: number): string {
  if (score >= 80) return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (score >= 60) return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300";
  if (score >= 40) return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

function getCoverageColor(status?: string): string {
  switch (status) {
    case "covered":
      return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
    case "missed":
      return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    case "partially":
    case "partially_covered":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300";
    default:
      return "";
  }
}

const coverageLabels: Record<string, string> = {
  covered: "已覆盖",
  missed: "未覆盖",
  partially: "部分覆盖",
  partially_covered: "部分覆盖",
};

function FeedItem({ item }: { item: PlatformContentUI }) {
  const [interpretation, setInterpretation] = useState<string | null>(
    item.aiInterpretation ?? null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleInterpret = useCallback(async () => {
    if (interpretation) {
      setExpanded((prev) => !prev);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/benchmarking/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId: item.id }),
      });
      if (!res.ok) throw new Error("请求失败");
      const data = await res.json();
      setInterpretation(data.interpretation);
      setExpanded(true);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, [interpretation, item.id]);

  return (
    <div className="rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
      {isRealArticleUrl(item.sourceUrl) ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline line-clamp-2"
        >
          {item.title}
        </a>
      ) : (
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
          {item.title}
        </span>
      )}

      {item.summary && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mt-1 line-clamp-2">
          {item.summary}
        </p>
      )}

      <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        <span>{item.platformName || "未知平台"}</span>
        {item.publishedAt && (
          <>
            <span>·</span>
            <span>发布于 {formatPublishTime(item.publishedAt)}</span>
          </>
        )}
        <span>·</span>
        <span>收录于 {formatRelativeTime(item.crawledAt)}</span>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <Badge
          variant="secondary"
          className={getImportanceColor(item.importance)}
        >
          {item.importance}分
        </Badge>

        {item.coverageStatus && coverageLabels[item.coverageStatus] && (
          <Badge
            variant="secondary"
            className={getCoverageColor(item.coverageStatus)}
          >
            {coverageLabels[item.coverageStatus]}
          </Badge>
        )}

        {item.topics.map((topic) => (
          <Badge
            key={topic}
            variant="secondary"
            className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          >
            {topic}
          </Badge>
        ))}

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 px-2 text-[11px] border-0"
          onClick={handleInterpret}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={11} className="mr-1 animate-spin" />
          ) : (
            <Sparkles size={11} className="mr-1" />
          )}
          {interpretation ? (expanded ? "收起" : "AI 解读") : "AI 解读"}
          {interpretation && !isLoading && (
            expanded ? <ChevronUp size={11} className="ml-0.5" /> : <ChevronDown size={11} className="ml-0.5" />
          )}
        </Button>
      </div>

      {expanded && interpretation && (
        <div className="mt-2 px-3 py-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
            {interpretation}
          </p>
        </div>
      )}
    </div>
  );
}

function FeedContent({ content }: { content: PlatformContentUI[] }) {
  return (
    <ScrollArea className="h-[480px]">
      <div className="space-y-1 px-4 pb-4">
        {content.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            暂无抓取内容
          </p>
        )}
        {content.map((item) => (
          <FeedItem key={item.id} item={item} />
        ))}
      </div>
    </ScrollArea>
  );
}

export function CrawlFeedList({ content, hideHeader }: CrawlFeedListProps) {
  if (hideHeader) {
    return <FeedContent content={content} />;
  }

  return (
    <GlassCard padding="none">
      <div className="p-4 pb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          抓取内容动态
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          共 {content.length} 条内容
        </p>
      </div>
      <FeedContent content={content} />
    </GlassCard>
  );
}
