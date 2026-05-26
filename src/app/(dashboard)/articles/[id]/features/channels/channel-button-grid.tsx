"use client";

import { cn } from "@/lib/utils";

interface ChannelDef {
  key: string;
  label: string;
  emoji: string;
  bg: string;
}

// 与 right-outer-nav 保持一致的渠道色板
const CHANNELS: ChannelDef[] = [
  { key: "wechat_oa", label: "微信", emoji: "💬", bg: "bg-green-500/10 ring-green-500/30" },
  { key: "weibo", label: "微博", emoji: "🔥", bg: "bg-red-500/10 ring-red-500/30" },
  { key: "douyin", label: "抖音", emoji: "🎵", bg: "bg-black/15 dark:bg-white/10 ring-gray-400/30" },
  { key: "xiaohongshu", label: "小红书", emoji: "📕", bg: "bg-rose-500/10 ring-rose-500/30" },
  { key: "zhihu", label: "知乎", emoji: "💡", bg: "bg-blue-500/10 ring-blue-500/30" },
  { key: "toutiao", label: "头条", emoji: "📰", bg: "bg-orange-500/10 ring-orange-500/30" },
];

interface ChannelButtonGridProps {
  active: string;
  onChange: (key: string) => void;
}

// 预览模式的渠道选择器：在不增加面板宽度的前提下，用 3 列按钮栅格代替顶部 tab。
// 与编辑模式 right-outer-nav 的视觉风格保持一致，差异仅在排布（栅格 vs 竖列）。
export function ChannelButtonGrid({ active, onChange }: ChannelButtonGridProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5 px-3 py-2 border-b border-[var(--glass-border)]">
      {CHANNELS.map((c) => {
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            title={c.label}
            className={cn(
              "aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all",
              isActive
                ? "bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-sm"
                : `${c.bg} ring-1 text-foreground hover:scale-105`,
            )}
          >
            <span className="text-base">{c.emoji}</span>
            <span className="text-[10px] leading-tight">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}
