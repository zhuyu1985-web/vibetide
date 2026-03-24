"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Pencil,
  Type,
  Sparkles,
  PenLine,
  MoreHorizontal,
} from "lucide-react";
import { useArticlePageStore } from "../../store";
import { ViewSwitcher } from "./view-switcher";
import { AppearancePopover } from "./appearance-popover";
import { ActionsMenu } from "./actions-menu";
import { cn } from "@/lib/utils";
import type { ArticleDetail } from "@/lib/types";
import type { AppearanceSettings } from "../../types";

interface ArticleHeaderProps {
  article: ArticleDetail;
  annotationCount: number;
  appearance: AppearanceSettings;
  onUpdateAppearance: (updates: Partial<AppearanceSettings>) => void;
}

export function ArticleHeader({
  article,
  annotationCount,
  appearance,
  onUpdateAppearance,
}: ArticleHeaderProps) {
  const router = useRouter();
  const viewMode = useArticlePageStore((s) => s.viewMode);
  const setViewMode = useArticlePageStore((s) => s.setViewMode);

  const [showAppearance, setShowAppearance] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  return (
    <div className="relative h-12 flex items-center justify-between px-4 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl shrink-0">
      {/* Left: back + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => router.push("/articles")}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1 text-sm text-muted-foreground truncate">
          <span className="hover:text-foreground cursor-pointer" onClick={() => router.push("/articles")}>
            稿件管理
          </span>
          <span>/</span>
          <span className="text-foreground truncate">
            {article.categoryName ?? "未分类"}
          </span>
        </div>
      </div>

      {/* Center: view switcher */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <ViewSwitcher />
      </div>

      {/* Right: toolbar icons */}
      <div className="flex items-center gap-1 shrink-0 relative">
        {/* Read / Edit toggle */}
        <button
          onClick={() => setViewMode(viewMode === "read" ? "edit" : "read")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            viewMode === "edit"
              ? "bg-blue-500/15 text-blue-500"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}
        >
          {viewMode === "read" ? (
            <>
              <Pencil className="h-3.5 w-3.5" />
              <span>编辑</span>
            </>
          ) : (
            <>
              <BookOpen className="h-3.5 w-3.5" />
              <span>阅读</span>
            </>
          )}
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Type (Aa) — appearance popover trigger */}
        <div className="relative">
          <button
            onClick={() => {
              setShowAppearance((v) => !v);
              setShowActionsMenu(false);
            }}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              showAppearance
                ? "bg-blue-500/10 text-blue-500"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <Type className="h-4 w-4" />
          </button>
          {showAppearance && (
            <AppearancePopover
              appearance={appearance}
              onUpdate={onUpdateAppearance}
              onClose={() => setShowAppearance(false)}
            />
          )}
        </div>

        {/* Sparkles (AI) */}
        <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
          <Sparkles className="h-4 w-4" />
        </button>

        {/* PenLine (annotations) with count badge */}
        <button className="relative p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
          <PenLine className="h-4 w-4" />
          {annotationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-blue-500 text-white text-[10px] font-medium px-1">
              {annotationCount > 99 ? "99+" : annotationCount}
            </span>
          )}
        </button>

        {/* More actions — actions menu trigger */}
        <div className="relative">
          <button
            onClick={() => {
              setShowActionsMenu((v) => !v);
              setShowAppearance(false);
            }}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              showActionsMenu
                ? "bg-blue-500/10 text-blue-500"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showActionsMenu && (
            <ActionsMenu
              articleId={article.id}
              articleUrl={undefined}
              onClose={() => setShowActionsMenu(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
