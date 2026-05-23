"use client";

/**
 * 编辑器左侧外层垂直 icon nav —— 简约风格（对齐用户参考图 #8 的全局侧栏）。
 *
 * 设计：
 *   - 窄条 56px（原 80px），纯图标无文字标签
 *   - 激活态：浅蓝填充背景 + 蓝色图标，无渐变色块
 *   - hover：浅 muted 背景 + 轻微 scale
 *   - title 属性提供 tooltip 提示当前是哪个分类
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
  { key: "library", label: "资源库", icon: Box },
  { key: "apps", label: "AIGC 应用", icon: AppWindow },
];

export function LeftOuterNav() {
  const leftCategory = useArticlePageStore((s) => s.leftCategory);
  const setLeftCategory = useArticlePageStore((s) => s.setLeftCategory);

  return (
    <div className="w-[56px] shrink-0 flex flex-col items-center py-3 gap-1 border-r border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const active = leftCategory === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => setLeftCategory(cat.key)}
            title={cat.label}
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
              active
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
          </button>
        );
      })}
    </div>
  );
}
