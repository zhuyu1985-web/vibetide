"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as LucideIcons from "lucide-react";
import { FileText, type LucideIcon } from "lucide-react";
import { SearchInput } from "@/components/shared/search-input";
import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Badge } from "@/components/ui/badge";
import type { WorkflowTemplateRow } from "@/db/types";

interface WorkflowsPanelProps {
  workflows: WorkflowTemplateRow[];
}

const CATEGORY_LABELS: Record<string, string> = {
  daily_brief: "日常简报",
  deep: "深度内容",
  news: "新闻资讯",
  podcast: "播客音频",
  livelihood: "民生内容",
  video: "视频制作",
  analytics: "数据分析",
  distribution: "渠道分发",
  advanced: "进阶场景",
  social: "社交平台",
  drama: "短剧",
  custom: "通用场景",
};

const CATEGORY_COLORS: Record<string, string> = {
  daily_brief: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  deep: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  news: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  podcast: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  livelihood: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  video: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  analytics: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  distribution: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  advanced: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  social: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  drama: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  custom: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

function resolveIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return FileText;
  const maybe = (LucideIcons as unknown as Record<string, LucideIcon>)[iconName];
  return maybe ?? FileText;
}

export function WorkflowsPanel({ workflows }: WorkflowsPanelProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return workflows.filter((w) => {
      if (categoryFilter !== "all" && w.category !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          w.name.toLowerCase().includes(q) ||
          (w.description ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [workflows, categoryFilter, search]);

  // Derive category tabs from actual data
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const w of workflows) if (w.category) set.add(w.category);
    return Array.from(set).sort();
  }, [workflows]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput
          placeholder="搜索工作流名称或描述..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors border-0 ${
              categoryFilter === "all"
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            全部 ({workflows.length})
          </button>
          {availableCategories.map((cat) => {
            const count = workflows.filter((w) => w.category === cat).length;
            const selected = categoryFilter === cat;
            return (
              <button
                type="button"
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors border-0 ${
                  selected
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {CATEGORY_LABELS[cat] ?? cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <GlassCard className="py-16">
          <div className="text-center text-sm text-gray-400 dark:text-gray-500">
            {workflows.length === 0
              ? "当前组织没有任何工作流。运行 `npx tsx src/db/seed.ts` 初始化。"
              : "没有符合当前筛选的工作流。"}
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((wf) => {
            const Icon = resolveIcon(wf.icon);
            const team = (wf.defaultTeam ?? []) as string[];
            const catLabel = CATEGORY_LABELS[wf.category ?? "custom"] ?? wf.category;
            const catColor =
              CATEGORY_COLORS[wf.category ?? "custom"] ??
              CATEGORY_COLORS["custom"];
            const hasSpec = wf.content && wf.content.length > 0;

            return (
              <Link
                key={wf.id}
                href={`/workflows/${wf.id}`}
                className="group"
              >
                <GlassCard className="h-full transition-shadow hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] cursor-pointer">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20 flex items-center justify-center shrink-0 group-hover:from-indigo-500/20 group-hover:to-violet-500/20 transition-colors">
                      <Icon size={20} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {wf.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${catColor} border-0`}
                        >
                          {catLabel}
                        </Badge>
                        {wf.isBuiltin && (
                          <Badge variant="outline" className="text-[10px] border-0 bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            内置
                          </Badge>
                        )}
                        {hasSpec && (
                          <Badge variant="outline" className="text-[10px] border-0 bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                            有规格文档
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {wf.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                      {wf.description}
                    </p>
                  )}

                  {/* Footer: team + app channel + steps */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {team.length > 0 && (
                        <div className="flex -space-x-1">
                          {team.slice(0, 4).map((slug) => (
                            <EmployeeAvatar
                              key={slug}
                              employeeId={slug}
                              size="xs"
                            />
                          ))}
                          {team.length > 4 && (
                            <span className="text-[10px] text-gray-400 ml-1.5">
                              +{team.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
                      {wf.appChannelSlug && (
                        <span className="truncate max-w-[100px]">
                          → {wf.appChannelSlug}
                        </span>
                      )}
                      <span className="text-gray-300 dark:text-gray-600">|</span>
                      <span>{(wf.steps as unknown[] | null)?.length ?? 0} 步</span>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
