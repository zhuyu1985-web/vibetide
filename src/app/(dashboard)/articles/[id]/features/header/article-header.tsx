"use client";

/**
 * 阅读模式顶栏。
 *
 * 左：返回箭头 + breadcrumb
 * 中：ViewSwitcher（沉浸 / web / brief / 存档）
 * 右：编辑按钮 + 更多操作下拉（含分享 / 访问 / 复制 / 导出 / 收藏 / 移动 / 归档 / 删除）
 *
 * 历史 header 里的 Type / Sparkles / PenLine 几个图标按钮已删除（与稿件操作无直接关系，
 * 易让用户误以为是功能入口，按 2026-05-23 用户反馈精简）。
 */

import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, MoreHorizontal } from "lucide-react";
import { useArticlePageStore } from "../../store";
import { ViewSwitcher } from "./view-switcher";
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
  // 保留 props 兼容旧调用，但当前 read header 不再使用这些字段
  // （外观弹出 / 批注计数 / AI 等图标按钮已按用户反馈精简）
}: ArticleHeaderProps) {
  const router = useRouter();
  const viewMode = useArticlePageStore((s) => s.viewMode);
  const setViewMode = useArticlePageStore((s) => s.setViewMode);

  return (
    <div className="relative h-12 flex items-center justify-between px-4 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl shrink-0">
      {/* 左：返回 + breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={() => router.push("/articles")}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1 text-sm text-muted-foreground truncate">
          <span
            className="hover:text-foreground cursor-pointer"
            onClick={() => router.push("/articles")}
          >
            稿件管理
          </span>
          <span>/</span>
          <span className="text-foreground truncate">
            {article.categoryName ?? "未分类"}
          </span>
        </div>
      </div>

      {/* 中：视图切换 */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <ViewSwitcher />
      </div>

      {/* 右：编辑按钮 + 更多操作 */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setViewMode(viewMode === "read" ? "edit" : "read")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
            viewMode === "edit"
              ? "bg-blue-500/15 text-blue-500"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          编辑
        </button>

        <ActionsMenu articleId={article.id} articleUrl={undefined}>
          <button
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title="更多操作"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </ActionsMenu>
      </div>
    </div>
  );
}
