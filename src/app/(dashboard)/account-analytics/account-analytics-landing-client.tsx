"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, TrendingUp, Calendar } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { PlatformAvatar } from "@/components/account-analytics/platform-avatar";
import { CrawlCronToggle } from "@/components/account-analytics/crawl-cron-toggle";
import { getPlatformMeta } from "@/lib/account-analytics/platform-meta";
import type { AnalyzableAccountRow } from "@/lib/dal/account-analytics";
import { cn } from "@/lib/utils";

const LEVEL_LABELS: Record<string, string> = {
  central: "央级",
  provincial: "省级",
  city: "市级",
  industry: "行业",
  self_media: "自媒体",
};

const SOURCE_LABELS: Record<"my" | "benchmark", string> = {
  my: "我方账号",
  benchmark: "对标账号",
};

interface Props {
  accounts: AnalyzableAccountRow[];
}

export function AccountAnalyticsLandingClient({ accounts }: Props) {
  const [keyword, setKeyword] = useState("");
  // 默认聚焦我方账号；切到「对标」才看 60+ 个全国预设账号池
  const [sourceFilter, setSourceFilter] = useState<"all" | "my" | "benchmark">(
    "my",
  );
  // 平台筛选 —— 'all' 表示不限平台
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  // 按 source 预筛后 → 计算每个平台的账号数（chip 上显示），再用 platformFilter 过滤
  const sourceFiltered = useMemo(
    () =>
      accounts.filter((a) => sourceFilter === "all" || a.source === sourceFilter),
    [accounts, sourceFilter],
  );

  const platformCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of sourceFiltered) {
      map.set(a.platform, (map.get(a.platform) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a); // 按数量降序
  }, [sourceFiltered]);

  const filtered = useMemo(() => {
    return sourceFiltered.filter((a) => {
      if (platformFilter !== "all" && a.platform !== platformFilter) return false;
      if (!keyword) return true;
      const kw = keyword.toLowerCase();
      return (
        a.name.toLowerCase().includes(kw) ||
        a.handle.toLowerCase().includes(kw) ||
        a.platform.toLowerCase().includes(kw)
      );
    });
  }, [sourceFiltered, keyword, platformFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="账号数据分析"
        description="选择一个账号查看每日 / 自定义区间的爆款归因报告"
      />

      {/* 顶部 filter 区 */}
      <GlassCard padding="md">
        <div className="flex flex-col gap-3">
          {/* 第一行：搜索 + 数据源切换 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <SearchInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索账号名 / 平台 / handle..."
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["all", "my", "benchmark"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSourceFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border-0 cursor-pointer",
                    sourceFilter === s
                      ? "bg-[#2E75B6] text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
                  )}
                >
                  {s === "all" ? "全部" : SOURCE_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="sm:ml-auto text-[12px] text-gray-500">
              共 {filtered.length} 个账号
            </div>
          </div>

          {/* 第二行：平台 chip 筛选（带平台品牌色） */}
          {platformCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-dashed border-gray-200 dark:border-gray-800">
              <span className="text-[11px] text-gray-400 mr-1">平台</span>
              <button
                type="button"
                onClick={() => setPlatformFilter("all")}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors border-0 cursor-pointer",
                  platformFilter === "all"
                    ? "bg-[#1F3864] text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
                )}
              >
                全平台
                <span className="text-[10px] opacity-70">{sourceFiltered.length}</span>
              </button>
              {platformCounts.map(([platform, count]) => {
                const meta = getPlatformMeta(platform);
                const active = platformFilter === platform;
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => setPlatformFilter(platform)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors border-0 cursor-pointer",
                      active
                        ? "text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
                    )}
                    style={active ? { backgroundColor: meta.color } : undefined}
                  >
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-white font-bold"
                      style={{ backgroundColor: meta.color }}
                    >
                      {meta.short.slice(0, 1)}
                    </span>
                    {meta.label}
                    <span className="text-[10px] opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>

      {/* 账号卡片网格 */}
      {filtered.length === 0 ? (
        <GlassCard padding="lg">
          <p className="text-center text-sm text-gray-500 py-8">
            暂无可分析账号。请先在「同题对比 / 我方账号」或「对标账号池」中添加。
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((account) => (
            <Link
              key={account.id}
              href={`/account-analytics/${account.id}`}
              className="block"
            >
              <GlassCard
                variant="interactive"
                hover
                padding="lg"
                className="h-full"
              >
                {/* 头像 + 平台色标识 */}
                <div className="flex items-start gap-3 mb-3">
                  <PlatformAvatar
                    platform={account.platform}
                    avatarUrl={account.avatarUrl}
                    accountChar={account.name}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200 truncate">
                      {account.name}
                    </h3>
                    <p className="text-[12px] text-gray-500 truncate mt-0.5">
                      @{account.handle}
                    </p>
                  </div>
                  <Badge
                    variant={account.source === "my" ? "default" : "secondary"}
                    className="shrink-0"
                  >
                    {SOURCE_LABELS[account.source]}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(() => {
                    const meta = getPlatformMeta(account.platform);
                    return (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] text-white font-medium"
                        style={{ backgroundColor: meta.color }}
                      >
                        {meta.label}
                      </span>
                    );
                  })()}
                  {account.level && (
                    <Badge variant="outline" className="text-[11px]">
                      {LEVEL_LABELS[account.level] ?? account.level}
                    </Badge>
                  )}
                  {account.region && (
                    <Badge variant="outline" className="text-[11px]">
                      {account.region}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-[12px] text-gray-500 mb-2">
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} />
                    {account.daysWithData ?? 0} 天数据
                  </span>
                  {account.latestReportAt ? (
                    <span className="inline-flex items-center gap-1 text-[#2E75B6]">
                      <BarChart3 size={12} />
                      最新报告 {account.latestReportAt.slice(5, 10)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-gray-400">
                      <TrendingUp size={12} />
                      暂无报告
                    </span>
                  )}
                </div>

                {/* 自动抓取开关 + last_crawl */}
                <div className="pt-2 mt-2 border-t border-dashed border-gray-200 dark:border-gray-800">
                  <CrawlCronToggle
                    accountId={account.id}
                    accountSource={account.source}
                    platform={account.platform}
                    initialEnabled={account.crawlCronEnabled ?? false}
                    hasIdentifier={account.hasIdentifier ?? false}
                    lastCrawledAt={account.lastCrawledAt}
                    hasOutletBinding={account.hasOutletBinding ?? false}
                  />
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
