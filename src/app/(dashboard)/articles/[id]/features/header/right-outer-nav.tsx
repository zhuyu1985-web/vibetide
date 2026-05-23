"use client";

/**
 * 编辑器右侧 80px 外层垂直 icon nav。
 *
 * 对齐参考图 #5：
 *   - 顶部：「基本信息」竖排 tab（默认激活，蓝色高亮）
 *   - 下方：+ 按钮（添加新渠道，stub）
 *   - 下方：渠道图标列表（微信/微博/抖音/小红书/知乎/头条 等）
 *   - 点击某渠道 → 右二列切到该渠道的改写面板
 */

import { Plus } from "lucide-react";
import { useArticlePageStore } from "../../store";
import { cn } from "@/lib/utils";

interface ChannelDef {
  key: string;
  label: string;
  emoji: string;
  /** 徽章背景色（参照各家品牌色，半透明 + 边框） */
  bg: string;
}

const CHANNELS: ChannelDef[] = [
  { key: "wechat_oa", label: "微信", emoji: "💬", bg: "bg-green-500/10 ring-green-500/30" },
  { key: "weibo", label: "微博", emoji: "🔥", bg: "bg-red-500/10 ring-red-500/30" },
  { key: "douyin", label: "抖音", emoji: "🎵", bg: "bg-black/15 dark:bg-white/10 ring-gray-400/30" },
  { key: "xiaohongshu", label: "小红书", emoji: "📕", bg: "bg-rose-500/10 ring-rose-500/30" },
  { key: "zhihu", label: "知乎", emoji: "💡", bg: "bg-blue-500/10 ring-blue-500/30" },
  { key: "toutiao", label: "头条", emoji: "📰", bg: "bg-orange-500/10 ring-orange-500/30" },
];

export function RightOuterNav() {
  const rightCategory = useArticlePageStore((s) => s.rightCategory);
  const activeChannel = useArticlePageStore((s) => s.activeChannel);
  const setRightCategory = useArticlePageStore((s) => s.setRightCategory);
  const setActiveChannel = useArticlePageStore((s) => s.setActiveChannel);

  const infoActive = rightCategory === "info";

  return (
    <div className="w-[80px] shrink-0 flex flex-col items-stretch border-l border-[var(--glass-border)] bg-gradient-to-b from-blue-50/40 via-violet-50/30 to-blue-50/40 dark:from-blue-950/20 dark:via-violet-950/15 dark:to-blue-950/20 py-3 gap-2">
      {/* 基本信息（竖排 tab） */}
      <button
        onClick={() => setRightCategory("info")}
        className={cn(
          "relative mx-2 px-2 py-3 rounded-lg text-xs font-medium transition-colors",
          infoActive
            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
            : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/5",
        )}
      >
        {infoActive && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-l" />
        )}
        <span className="block leading-tight">基本</span>
        <span className="block leading-tight">信息</span>
      </button>

      {/* + 按钮 */}
      <button
        onClick={() => alert("「添加渠道」即将上线。")}
        className="mx-auto w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/15 to-blue-500/15 hover:from-violet-500/25 hover:to-blue-500/25 flex items-center justify-center text-violet-600 dark:text-violet-400 transition-colors"
        title="添加渠道"
      >
        <Plus className="h-4 w-4" />
      </button>

      {/* 渠道列表 */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1.5">
        {CHANNELS.map((c) => {
          const active =
            rightCategory === "channel" && activeChannel === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setActiveChannel(c.key)}
              title={c.label}
              className={cn(
                "relative w-full aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all",
                active
                  ? "bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-sm"
                  : `${c.bg} ring-1 text-foreground hover:scale-105`,
              )}
            >
              {active && (
                <span className="absolute right-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-l" />
              )}
              <span className="text-lg">{c.emoji}</span>
              <span className="text-[10px] leading-tight">{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
