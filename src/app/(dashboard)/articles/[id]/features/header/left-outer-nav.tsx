"use client";

/**
 * 编辑器左侧外层垂直 icon nav。
 *
 * 设计要点（迭代到第 3 版，2026-05-23）：
 *   - 68px 宽，比全局左侧栏（54px）略宽 —— 便于与全局栏视觉区分
 *   - 图标 + 中文小标签（10px）成组：用户能一眼分清这是「编辑器三栏入口」
 *     而不是全局菜单图标
 *   - 激活态：浅蓝填充 + 蓝色 stroke icon
 *   - hover：muted 背景
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
  { key: "apps", label: "AIGC", icon: AppWindow },
];

export function LeftOuterNav() {
  const leftCategory = useArticlePageStore((s) => s.leftCategory);
  const setLeftCategory = useArticlePageStore((s) => s.setLeftCategory);

  return (
    <div className="w-[68px] shrink-0 flex flex-col items-stretch py-2 border-r border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const active = leftCategory === cat.key;
        return (
          <button
            key={cat.key}
            onClick={() => setLeftCategory(cat.key)}
            title={cat.label}
            className={cn(
              "mx-1.5 my-0.5 px-1 py-2 rounded-lg flex flex-col items-center gap-1 transition-all",
              active
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            <Icon
              className="h-5 w-5"
              strokeWidth={active ? 2.2 : 1.8}
            />
            <span className="text-[10px] leading-none">{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
