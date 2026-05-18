"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, FileText, Edit3, Radio, BarChart3, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import {
  CHANNEL_FILTER_LABELS,
  formatChannelLabel,
  getPlatformChipClass,
  type ChannelFilterLabel,
} from "@/lib/collection/constants";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/format";
import { searchCollectedItemsByTopicAction } from "@/app/actions/research/research-topics";
import type { TopicSummary } from "@/lib/dal/research/research-topics";
import type { CollectedItemWithAnnotations } from "@/lib/dal/research/collected-item-search";

type TimeWindow = "24h" | "7d" | "30d" | "all";

const TIME_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "24h", label: "24 小时" },
  { value: "7d", label: "7 天" },
  { value: "30d", label: "30 天" },
  { value: "all", label: "全部" },
];

const PAGE_SIZE = 50;

function timeWindowToFrom(tw: TimeWindow): number | undefined {
  if (tw === "all") return undefined;
  const hours = tw === "24h" ? 24 : tw === "30d" ? 24 * 30 : 24 * 7;
  return Date.now() - hours * 60 * 60 * 1000;
}

interface TopicDetailPanelProps {
  topic: TopicSummary;
  onEdit: () => void;
}

export function TopicDetailPanel({ topic, onEdit }: TopicDetailPanelProps) {
  const [items, setItems] = useState<CollectedItemWithAnnotations[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedChannels, setSelectedChannels] = useState<ChannelFilterLabel[]>([]);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");

  // Debounce keyword
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  // Reset filters when topic changes.
  useEffect(() => {
    setSelectedChannels([]);
    setTimeWindow("all");
    setKeyword("");
    setDebouncedKeyword("");
  }, [topic.id]);

  const loadData = useCallback(() => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await searchCollectedItemsByTopicAction(
          topic.id,
          {
            channelLabels: selectedChannels.length > 0 ? selectedChannels : undefined,
            publishedAtFrom: timeWindowToFrom(timeWindow),
            titleKeyword: debouncedKeyword.trim() || undefined,
          },
          { limit: PAGE_SIZE, offset: 0 },
        );
        setItems(res.items);
        setTotal(res.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
        setItems([]);
        setTotal(0);
      }
    });
  }, [topic.id, selectedChannels, timeWindow, debouncedKeyword]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleChannel(label: ChannelFilterLabel) {
    setSelectedChannels((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  }

  // Distinct firstSeenChannel labels seen in current results — surface as quick chips.
  const seenChannelLabels = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      const label = formatChannelLabel(it.firstSeenChannel);
      if (label && label !== "—") set.add(label);
    }
    return set;
  }, [items]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {/* Header: title + actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-semibold text-foreground">
              {topic.name}
            </h2>
            {topic.isPreset && (
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
                预置
              </Badge>
            )}
          </div>
          {topic.description && (
            <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            共词 {topic.primaryKeyword ?? "未设置"} · 别名 {topic.aliasCount} · 样本{" "}
            {topic.sampleCount}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit3 className="mr-1 h-3.5 w-3.5" />
            编辑方案
          </Button>
          <Button variant="ghost" size="sm" disabled>
            <Radio className="mr-1 h-3.5 w-3.5" />
            定向信源
          </Button>
          <Button variant="ghost" size="sm" disabled>
            <BarChart3 className="mr-1 h-3.5 w-3.5" />
            数据看板
          </Button>
          <Button variant="ghost" size="sm" disabled>
            <FileBarChart className="mr-1 h-3.5 w-3.5" />
            一键报告
          </Button>
        </div>
      </div>

      {/* Filter row */}
      <GlassCard variant="panel" padding="md" className="space-y-3">
        {/* Channel chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">信息来源</span>
          {CHANNEL_FILTER_LABELS.map((label) => {
            const active = selectedChannels.includes(label);
            const seen = seenChannelLabels.has(label);
            return (
              <Button
                key={label}
                variant="ghost"
                size="sm"
                onClick={() => toggleChannel(label)}
                className={cn(
                  "h-6 rounded-full px-2.5 text-[11px]",
                  active && "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
                  !active && !seen && "text-muted-foreground/60",
                )}
              >
                {label}
              </Button>
            );
          })}
        </div>

        {/* Time window + keyword search */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">监测时间</span>
          {TIME_OPTIONS.map((opt) => {
            const active = timeWindow === opt.value;
            return (
              <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                onClick={() => setTimeWindow(opt.value)}
                className={cn(
                  "h-6 rounded-full px-2.5 text-[11px]",
                  active && "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
                )}
              >
                {opt.label}
              </Button>
            );
          })}
          <div className="ml-auto">
            <SearchInput
              className="w-56"
              placeholder="搜索命中标题…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              inputClassName="h-8 text-xs"
            />
          </div>
        </div>
      </GlassCard>

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {loading
            ? "加载中…"
            : total > 0
              ? `已加载 ${items.length} / ${total} 条命中`
              : "暂无命中"}
        </p>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {loading && items.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          正在拉取命中结果…
        </div>
      ) : items.length === 0 ? (
        <GlassCard variant="panel" padding="none">
          <EmptyState
            icon={FileText}
            title="暂无命中"
            description="该主题当前 filter 下没有命中的采集卡片。"
          />
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => (
            <HitCard key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  );
}

function HitCard({ item }: { item: CollectedItemWithAnnotations }) {
  const channelLabel = formatChannelLabel(item.firstSeenChannel);
  const time = item.publishedAt ?? null;
  return (
    <GlassCard
      variant="interactive"
      padding="md"
      hover
      className="flex flex-col gap-2"
    >
      <div className="flex items-start gap-2">
        <h3 className="line-clamp-2 flex-1 text-sm font-medium text-foreground">
          {item.title}
        </h3>
      </div>
      {item.content && (
        <p className="line-clamp-3 text-xs text-muted-foreground">{item.content}</p>
      )}
      <div className="mt-auto flex items-center gap-2 text-[10px] text-muted-foreground">
        {channelLabel && channelLabel !== "—" && (
          <span
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5",
              getPlatformChipClass(channelLabel),
            )}
          >
            {channelLabel}
          </span>
        )}
        {item.outletName && <span className="truncate">{item.outletName}</span>}
        {time && (
          <span
            className="ml-auto whitespace-nowrap"
            title={formatAbsoluteTime(time)}
          >
            {formatRelativeTime(time)}
          </span>
        )}
      </div>
    </GlassCard>
  );
}
