"use client";

/**
 * 编辑器左侧 80px 外层垂直 icon nav。
 *
 * 对齐参考图 #5：6 个分类（图标 + 标签），点击切换内层 panel 内容。
 * 前 3 项已实现；后 3 项（排版样式 / 智能审校 / 稿库）点击弹「即将上线」。
 */

import {
  Sparkles,
  Box,
  AppWindow,
} from "lucide-react";
import { useArticlePageStore } from "../../store";
import { cn } from "@/lib/utils";
import type { LeftCategory } from "../../types";

interface CategoryDef {
  key: LeftCategory;
  label: string;
  icon: React.ElementType;
}

// 按用户原始需求：左侧只要 AI助手 / 资源库（素材资源）/ AIGC（应用）三项。
const CATEGORIES: CategoryDef[] = [
  { key: "ai", label: "AI助手", icon: Sparkles },
  { key: "library", label: "素材资源", icon: Box },
  { key: "apps", label: "AIGC", icon: AppWindow },
];

export function LeftOuterNav() {
  const leftCategory = useArticlePageStore((s) => s.leftCategory);
  const setLeftCategory = useArticlePageStore((s) => s.setLeftCategory);

  const handleClick = (cat: CategoryDef) => {
    setLeftCategory(cat.key);
  };

  return (
    <div className="w-[80px] shrink-0 flex flex-col items-stretch border-r border-[var(--glass-border)] bg-gradient-to-b from-blue-50/40 via-violet-50/30 to-blue-50/40 dark:from-blue-950/20 dark:via-violet-950/15 dark:to-blue-950/20">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const active = leftCategory === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => handleClick(cat)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 py-3 transition-all",
              active
                ? "text-blue-600 dark:text-blue-400"
                : "text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/5",
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-blue-500 rounded-r" />
            )}
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                active
                  ? "bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-sm"
                  : "bg-white/60 dark:bg-white/5",
              )}
            >
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-xs leading-tight">{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
