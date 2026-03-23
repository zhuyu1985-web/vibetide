"use client";

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
import { cn } from "@/lib/utils";
import type { ArticleDetail } from "@/lib/types";

interface ArticleHeaderProps {
  article: ArticleDetail;
  annotationCount: number;
}

export function ArticleHeader({ article, annotationCount }: ArticleHeaderProps) {
  const router = useRouter();
  const viewMode = useArticlePageStore((s) => s.viewMode);
  const setViewMode = useArticlePageStore((s) => s.setViewMode);

  return (
    <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl shrink-0">
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
      <div className="flex items-center gap-1 shrink-0">
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

        {/* Type (Aa) */}
        <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
          <Type className="h-4 w-4" />
        </button>

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

        {/* More actions */}
        <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
