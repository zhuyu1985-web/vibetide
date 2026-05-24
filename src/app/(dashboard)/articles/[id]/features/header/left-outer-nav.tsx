"use client";

/**
 * 编辑器左侧外层垂直 icon nav（最终版，对齐用户参考图 #9）。
 *
 * 规格：
 *   - 80px 宽
 *   - 每项独立按钮，大图标盒 11x11 + 5x5 icon + 中文标签 11px
 *   - 激活态：蓝紫渐变背景 + 白色 icon + 蓝色标签
 *   - hover：muted 浅背景
 *   - 上下 padding 充裕，三项垂直分布有呼吸感
 */

import { Sparkles, Box, AppWindow } from "lucide-react";
import { useArticlePageStore } from "../../store";
import { cn } from "@/lib/utils";
import type { LeftCategory } from "../../types";

interface CategoryDef {
  key: LeftCategory;
  label: string;
  icon: React.ElementType;
}

const CATEGORIES: CategoryDef[] = [
  { key: "ai", label: "AI 助手", icon: Sparkles },
  { key: "library", label: "素材资源", icon: Box },
  { key: "apps", label: "AIGC", icon: AppWindow },
];

export function LeftOuterNav() {
  const leftCategory = useArticlePageStore((s) => s.leftCategory);
  const setLeftCategory = useArticlePageStore((s) => s.setLeftCategory);

  return (
    <div className="w-[80px] shrink-0 flex flex-col items-stretch py-2 border-r border-[var(--glass-border)] bg-gradient-to-b from-sky-50/60 via-blue-50/30 to-sky-50/60 dark:from-sky-500/[0.06] dark:via-blue-500/[0.04] dark:to-sky-500/[0.06] backdrop-blur-xl">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const active = leftCategory === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => setLeftCategory(cat.key)}
            title={cat.label}
            className={cn(
              "mx-2 my-0.5 py-1.5 rounded-xl flex flex-col items-center gap-1 transition-all",
              active
                ? "text-indigo-600 dark:text-sky-300"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "w-[52px] h-[52px] rounded-xl flex items-center justify-center transition-all",
                active
                  ? "bg-gradient-to-br from-indigo-500/85 via-blue-500/85 to-sky-400/85 text-white shadow-sm shadow-indigo-500/20"
                  : "bg-white/60 dark:bg-white/5",
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={1.9} />
            </span>
            <span className="text-[11px] leading-none font-medium">{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
