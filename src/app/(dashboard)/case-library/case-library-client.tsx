"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import type { CaseLibraryItem } from "@/lib/types";
import {
  Trophy,
  Filter,
  Star,
  BookOpen,
  TrendingUp,
  Tag,
} from "lucide-react";

interface CaseLibraryClientProps {
  cases: CaseLibraryItem[];
}

const factorLabels: Record<string, string> = {
  titleStrategy: "标题策略",
  topicAngle: "选题角度",
  contentStructure: "内容结构",
  emotionalResonance: "情感共鸣",
};

export default function CaseLibraryClient({
  cases,
}: CaseLibraryClientProps) {
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"score" | "date">("score");

  // Extract all unique tags
  const allTags = Array.from(
    new Set(cases.flatMap((c) => c.tags))
  ).slice(0, 10);

  const filtered = cases.filter(
    (c) => tagFilter === "all" || c.tags.includes(tagFilter)
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "score") return b.score - a.score;
    return (
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  });

  // Stats
  const avgScore =
    cases.length > 0
      ? Math.round(cases.reduce((sum, c) => sum + c.score, 0) / cases.length)
      : 0;
  const topScoreCase = cases.length > 0
    ? cases.reduce((best, c) => (c.score > best.score ? c : best))
    : null;

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="优秀案例库"
        description="效果评分>=80的内容自动入库，标注成功要素 (F3.3.02)"
        actions={
          <div className="flex items-center gap-2">
            <EmployeeAvatar employeeId="xiaoshu" size="xs" />
            <span className="text-xs text-gray-500 dark:text-gray-400">小数 自动入库标注</span>
            <Badge variant="outline" className="text-xs">
              {cases.length} 条精品
            </Badge>
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center">
              <Trophy size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">案例总数</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{cases.length}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/50 flex items-center justify-center">
              <Star size={16} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">平均评分</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{avgScore}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">最高分</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {topScoreCase?.score || 0}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Filter size={14} className="text-gray-400 dark:text-gray-500" />
        <span className="text-xs text-gray-500 dark:text-gray-400">标签：</span>
        <Badge
          variant={tagFilter === "all" ? "default" : "outline"}
          className="text-xs cursor-pointer"
          onClick={() => setTagFilter("all")}
        >
          全部
        </Badge>
        {allTags.map((tag) => (
          <Badge
            key={tag}
            variant={tagFilter === tag ? "default" : "outline"}
            className="text-xs cursor-pointer"
            onClick={() => setTagFilter(tag)}
          >
            {tag}
          </Badge>
        ))}
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-4">排序：</span>
        <Badge
          variant={sortBy === "score" ? "default" : "outline"}
          className="text-xs cursor-pointer"
          onClick={() => setSortBy("score")}
        >
          评分
        </Badge>
        <Badge
          variant={sortBy === "date" ? "default" : "outline"}
          className="text-xs cursor-pointer"
          onClick={() => setSortBy("date")}
        >
          时间
        </Badge>
      </div>

      {/* Cases Grid */}
      {sorted.length === 0 ? (
        <GlassCard className="text-center py-12">
          <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            暂无优秀案例
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            内容效果评分达到80分以上时，小数会自动将其加入案例库
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((item) => (
            <GlassCard key={item.id} variant="interactive">
              <div className="flex items-start gap-3">
                {/* Score */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                    item.score >= 90
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  }`}
                >
                  {item.score}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    {item.channel && (
                      <Badge variant="secondary" className="text-[10px]">
                        {item.channel}
                      </Badge>
                    )}
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleDateString(
                            "zh-CN"
                          )
                        : new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>

                  {/* Success Factors */}
                  {item.successFactors && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(item.successFactors).map(
                        ([key, value]) =>
                          value && (
                            <div
                              key={key}
                              className="text-[10px] text-gray-600 dark:text-gray-400"
                            >
                              <span className="font-medium text-gray-700 dark:text-gray-300">
                                {factorLabels[key] || key}:
                              </span>{" "}
                              {value}
                            </div>
                          )
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {item.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <Tag size={10} className="text-gray-400 dark:text-gray-500" />
                      {item.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-[9px] h-4 px-1"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
