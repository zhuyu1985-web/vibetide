"use client";

/**
 * 「智能编辑器」品牌顶栏（仅 viewMode='edit' 时显示）。
 *
 * 对齐用户提供的参考图 #5：
 *   [logo + 智能编辑器]                          [☁ 同步指示] [关闭][预览][保存][保存并提交][⚙]
 */

import { useRouter } from "next/navigation";
import { Cloud, Settings, X } from "lucide-react";
import { useArticlePageStore } from "../../store";
import { cn } from "@/lib/utils";

interface EditorTopBarProps {
  articleId: string;
}

export function EditorTopBar({ articleId }: EditorTopBarProps) {
  const router = useRouter();
  const setViewMode = useArticlePageStore((s) => s.setViewMode);
  const editorIsSaving = useArticlePageStore((s) => s.editorIsSaving);
  const editorIsDirty = useArticlePageStore((s) => s.editorIsDirty);
  const editorHandlers = useArticlePageStore((s) => s.editorHandlers);

  const handleClose = () => {
    router.push("/articles");
  };

  const handlePreview = () => {
    setViewMode("read");
  };

  void articleId; // 保留参数供未来扩展（如分享链接 / 复制 articleId）

  const isSaved = !editorIsDirty && !editorIsSaving;

  return (
    <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl shrink-0">
      {/* 左：Logo + 智能编辑器 */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white shadow-sm">
          <span className="text-base font-bold">✦</span>
        </div>
        <span className="text-base font-semibold text-foreground tracking-wide">
          智能编辑器
        </span>
      </div>

      {/* 右：保存状态 + 4 个按钮 + 设置 */}
      <div className="flex items-center gap-2 shrink-0">
        {/* 同步指示 */}
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors",
            editorIsSaving
              ? "text-blue-500"
              : isSaved
                ? "text-emerald-500"
                : "text-amber-500",
          )}
          title={
            editorIsSaving
              ? "正在保存…"
              : isSaved
                ? "已同步至云端"
                : "有未保存的更改"
          }
        >
          <Cloud className="h-4 w-4" />
        </div>

        <button
          onClick={handleClose}
          className="h-8 flex items-center gap-1 px-3 rounded-md text-xs font-medium text-muted-foreground bg-muted/30 dark:bg-white/5 hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          关闭
        </button>

        <button
          onClick={handlePreview}
          className="h-8 px-3 rounded-md text-xs font-medium text-muted-foreground bg-muted/30 dark:bg-white/5 hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          预览
        </button>

        <button
          onClick={() => editorHandlers?.save()}
          disabled={editorIsSaving || !editorIsDirty}
          className={cn(
            "h-8 px-3 rounded-md text-xs font-medium transition-colors",
            editorIsDirty && !editorIsSaving
              ? "text-blue-600 bg-blue-50 dark:bg-blue-500/15 hover:bg-blue-100 dark:hover:bg-blue-500/25"
              : "text-muted-foreground bg-muted/30 dark:bg-white/5 opacity-60",
          )}
        >
          {editorIsSaving ? "保存中…" : "保存"}
        </button>

        <button
          onClick={() => editorHandlers?.saveAndSubmit()}
          disabled={editorIsSaving}
          className="h-8 px-4 rounded-md text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-60"
        >
          保存并提交
        </button>

        <button
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="设置"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
