import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformAvatar } from "./platform-avatar";

export interface CoverKpiItem {
  label: string;
  value: string | number;
  /** 可选 accent 颜色（覆盖默认蓝色） */
  accent?: string;
}

interface ReportCoverProps {
  badge: string; // 例如 "抖音账号数据分析报告"
  accountName: string; // 例如 "BRTV 新闻"
  /** 平台 slug，用于 PlatformAvatar 取品牌色 */
  platform: string;
  /** 账号头像 URL（来自 my_accounts.avatarUrl），无则降级到平台色块字母 */
  avatarUrl?: string | null;
  periodLabel: string; // 例如 "抖音账号 · 2026-05-13（昨日）"
  kpis: CoverKpiItem[];
  /** 可选：右上角"昨日热度指数"等总分 */
  highlightValue?: string | number;
  highlightLabel?: string;
  /** 可选：右上角 actions 槽位（外部传入按钮） */
  actions?: React.ReactNode;
  className?: string;
}

/**
 * 紧凑版报告封面 —— 横向布局：左侧账号信息 + 中间区间 + 右侧热度指数 + 底部 KPI 行。
 * 高度由原 280px 压到 ~140px。
 */
export function ReportCover({
  badge,
  accountName,
  platform,
  avatarUrl,
  periodLabel,
  kpis,
  highlightValue,
  highlightLabel = "本期综合指数",
  actions,
  className,
}: ReportCoverProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl",
        "bg-white dark:bg-slate-900",
        "border border-[#E8EEF4] dark:border-slate-800",
        "shadow-[0_2px_12px_rgba(31,56,100,0.06)]",
        className,
      )}
    >
      {/* 上部：account 信息行 + 热度指数 */}
      <div className="flex items-center gap-4 px-5 py-4 sm:px-6 sm:py-5 border-b border-[#F0F4F9] dark:border-slate-800">
        {/* 头像 —— 优先用 my_accounts.avatarUrl，无则平台色块字母 */}
        <PlatformAvatar
          platform={platform}
          avatarUrl={avatarUrl}
          accountChar={accountName}
          size="lg"
        />

        {/* 中部：账号名 + badge + 区间 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[18px] sm:text-[20px] font-bold text-[#1F3864] dark:text-blue-100 leading-tight truncate">
              {accountName}
            </h1>
            <span className="inline-flex items-center rounded-full bg-[#EEF4FB] dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-medium text-[#2E75B6] dark:text-blue-300">
              {badge}
            </span>
          </div>
          <p className="mt-1 text-[12px] sm:text-[13px] text-gray-500 dark:text-gray-400">
            {periodLabel}
          </p>
        </div>

        {/* 右侧：操作 + 热度指数 */}
        <div className="hidden md:flex items-center gap-4">
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
          {highlightValue !== undefined && (
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 text-[22px] sm:text-[26px] font-bold text-[#E84057] leading-none">
                <Flame size={20} className="text-[#FF7A1A]" />
                {typeof highlightValue === "number"
                  ? highlightValue.toLocaleString("zh-CN")
                  : highlightValue}
              </div>
              <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {highlightLabel}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 下部：KPI 横向条 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-[#F0F4F9] dark:divide-slate-800">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="px-4 py-3 sm:py-4 text-center"
          >
            <div
              className="text-[18px] sm:text-[22px] font-bold leading-none"
              style={{ color: kpi.accent ?? "#1F3864" }}
            >
              {kpi.value}
            </div>
            <div className="mt-1.5 text-[11px] sm:text-[12px] text-gray-500 dark:text-gray-400">
              {kpi.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
