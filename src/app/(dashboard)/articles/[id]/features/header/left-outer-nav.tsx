"use client";

/**
 * 编辑器左侧 80px 外层垂直 icon nav。
 *
 * 对齐参考图 #5：6 个分类（图标 + 标签），点击切换内层 panel 内容。
 * 前 3 项已实现；后 3 项（排版样式 / 智能审校 / 稿库）点击弹「即将上线」。
 */

import { useRouter } from "next/navigation";
import {
  Sparkles,
  Box,
  AppWindow,
  LayoutTemplate,
  ShieldCheck,
  FolderArchive,
} from "lucide-react";
import { useArticlePageStore } from "../../store";
import { cn } from "@/lib/utils";
import type { LeftCategory } from "../../types";

interface CategoryDef {
  key: LeftCategory;
  label: string;
  icon: React.ElementType;
  /** 是否为占位（点击给 toast 而不是切换） */
  placeholder?: boolean;
}

const CATEGORIES: CategoryDef[] = [
  { key: "ai", label: "AI助手", icon: Sparkles },
  { key: "library", label: "素材资源", icon: Box },
  { key: "apps", label: "应用", icon: AppWindow },
  { key: "typography", label: "排版样式", icon: LayoutTemplate, placeholder: true },
  { key: "review", label: "智能审校", icon: ShieldCheck, placeholder: true },
  { key: "storage", label: "稿库", icon: FolderArchive },
];

export function LeftOuterNav() {
  const router = useRouter();
  const leftCategory = useArticlePageStore((s) => s.leftCategory);
  const setLeftCategory = useArticlePageStore((s) => s.setLeftCategory);

  const handleClick = (cat: CategoryDef) => {
    if (cat.key === "storage") {
      router.push("/articles");
      return;
    }
    if (cat.placeholder) {
      alert(`「${cat.label}」即将上线。`);
      return;
    }
    setLeftCategory(cat.key);
  };

  return (
    <div className="w-[80px] shrink-0 flex flex-col items-stretch border-r border-[var(--glass-border)] bg-gradient-to-b from-blue-50/40 via-violet-50/30 to-blue-50/40 dark:from-blue-950/20 dark:via-violet-950/15 dark:to-blue-950/20">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const active = leftCategory === cat.key && !cat.placeholder;
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
                "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                active
                  ? "bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-sm"
                  : "bg-white/60 dark:bg-white/5",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-[11px] leading-none">{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
}
