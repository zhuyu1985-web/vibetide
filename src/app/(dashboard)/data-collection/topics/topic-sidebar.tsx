"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, FolderPlus, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { SearchInput } from "@/components/shared/search-input";
import type { TopicSummary } from "@/lib/dal/research/research-topics";

const DEFAULT_GROUP_LABEL = "默认分组";
const NULL_GROUP_KEY = "__default__";

interface TopicSidebarProps {
  topics: TopicSummary[];
  groups: string[];
  selectedTopicId: string | null;
  onSelectTopic: (id: string) => void;
  onEditTopic: (id: string) => void;
  onOpenNewTopic: () => void;
  onOpenNewGroup: () => void;
}

export function TopicSidebar({
  topics,
  groups,
  selectedTopicId,
  onSelectTopic,
  onEditTopic,
  onOpenNewTopic,
  onOpenNewGroup,
}: TopicSidebarProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // Filter by name search.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((t) => t.name.toLowerCase().includes(q));
  }, [topics, query]);

  // Group topics. Null groupName → "默认分组"; otherwise alphabetic.
  const grouped = useMemo(() => {
    // Build full key list: known groups + default fallback.
    // groups param is already sorted alphabetically (DAL).
    const buckets = new Map<string, { key: string; label: string; items: TopicSummary[] }>();

    // Seed with default group (always shown if any null-group topic).
    buckets.set(NULL_GROUP_KEY, {
      key: NULL_GROUP_KEY,
      label: DEFAULT_GROUP_LABEL,
      items: [],
    });
    for (const g of groups) {
      buckets.set(g, { key: g, label: g, items: [] });
    }

    for (const t of filtered) {
      const k = t.groupName ?? NULL_GROUP_KEY;
      const bucket = buckets.get(k);
      if (bucket) {
        bucket.items.push(t);
      } else {
        // Topic referencing a group that's not in the groups list (edge case).
        buckets.set(k, { key: k, label: t.groupName ?? DEFAULT_GROUP_LABEL, items: [t] });
      }
    }

    // Order: default group first, then alphabetical.
    const arr = Array.from(buckets.values());
    arr.sort((a, b) => {
      if (a.key === NULL_GROUP_KEY) return -1;
      if (b.key === NULL_GROUP_KEY) return 1;
      return a.label.localeCompare(b.label);
    });
    // Hide empty groups (except default if entire list empty under it).
    return arr.filter((b) => b.items.length > 0);
  }, [filtered, groups]);

  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <GlassCard
      variant="panel"
      padding="none"
      className="flex h-[calc(100vh-220px)] min-h-[520px] w-[280px] shrink-0 flex-col"
    >
      {/* Top: search */}
      <div className="border-b border-white/10 p-3">
        <SearchInput
          placeholder="搜索主题…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputClassName="h-8 text-xs"
        />
      </div>

      {/* Middle: scrollable group list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            {query ? "没有匹配的主题" : "暂无主题，点击下方按钮创建"}
          </div>
        ) : (
          <div className="space-y-3 px-2 py-3">
            {grouped.map((bucket) => {
              const isCollapsed = collapsed.has(bucket.key);
              return (
                <div key={bucket.key}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleCollapse(bucket.key)}
                    className="w-full justify-start px-2 text-xs font-medium text-muted-foreground"
                  >
                    <ChevronDown
                      className={cn(
                        "mr-1 h-3.5 w-3.5 transition-transform",
                        isCollapsed && "-rotate-90",
                      )}
                    />
                    <span className="flex-1 truncate text-left">{bucket.label}</span>
                    <span className="ml-2 text-[10px] text-muted-foreground/70">
                      {bucket.items.length}
                    </span>
                  </Button>
                  {!isCollapsed && (
                    <div className="mt-1 space-y-0.5">
                      {bucket.items.map((t) => {
                        const isActive = t.id === selectedTopicId;
                        return (
                          <div
                            key={t.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelectTopic(t.id)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              onSelectTopic(t.id);
                            }}
                            className={cn(
                              "group relative flex h-auto w-full cursor-pointer items-center justify-start rounded-md py-2 pl-5 pr-2 text-left transition-colors hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:hover:bg-white/10",
                              isActive && "bg-sky-100/60 dark:bg-sky-900/30",
                            )}
                          >
                            {isActive && (
                              <span className="absolute left-1 top-1.5 bottom-1.5 w-0.5 rounded-full bg-sky-500" />
                            )}
                            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                              <div className="flex w-full items-center gap-1">
                                <span className="truncate text-xs font-medium text-foreground">
                                  {t.name}
                                </span>
                                {t.isPreset && (
                                  <Badge variant="secondary" className="ml-auto shrink-0 px-1 py-0 text-[9px]">
                                    预置
                                  </Badge>
                                )}
                              </div>
                              <span className="truncate text-[10px] text-muted-foreground">
                                共词 {t.primaryKeyword ?? "—"} · 样本 {t.sampleCount}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`编辑 ${t.name}`}
                              title="编辑主题词"
                              onClick={(event) => {
                                event.stopPropagation();
                                onEditTopic(t.id);
                              }}
                              className="ml-1 h-7 w-7 shrink-0 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom: actions */}
      <div className="border-t border-white/10 p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenNewGroup}
          className="w-full justify-start text-xs"
        >
          <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
          新建分组
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenNewTopic}
          className="w-full justify-start text-xs"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          创建方案
        </Button>
      </div>
    </GlassCard>
  );
}
