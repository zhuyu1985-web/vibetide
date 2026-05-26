"use client";

/**
 * 「智能编辑器」品牌顶栏（仅 viewMode='edit' 时显示）。
 *
 * 对齐用户提供的参考图 #5：
 *   [logo + 智能编辑器]                          [☁ 同步指示] [关闭][预览][保存][保存并提交][⚙]
 */

import { Cloud, Settings, X } from "lucide-react";
import { useArticlePageStore } from "../../store";
import { cn } from "@/lib/utils";

interface EditorTopBarProps {
  articleId: string;
}

export function EditorTopBar({ articleId }: EditorTopBarProps) {
  const setViewMode = useArticlePageStore((s) => s.setViewMode);
  const editorIsSaving = useArticlePageStore((s) => s.editorIsSaving);
  const editorIsDirty = useArticlePageStore((s) => s.editorIsDirty);
  const editorHandlers = useArticlePageStore((s) => s.editorHandlers);

  // 关闭 = 退出编辑模式，回到预览。
  // 若有未保存改动，走编辑器的 cancel handler（弹"放弃修改"确认框）；
  // 没改动则直接切回 read。
  const handleClose = () => {
    if (editorIsDirty && editorHandlers) {
      editorHandlers.cancel();
      return;
    }
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
          onClick={() => editorHandlers?.save()}
          disabled={editorIsSaving || !editorIsDirty}
          className={cn(
            "h-8 px-4 rounded-md text-xs font-medium transition-colors shadow-sm",
            editorIsDirty && !editorIsSaving
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-blue-500/40 text-white opacity-70 cursor-not-allowed",
          )}
        >
          {editorIsSaving ? "保存中…" : "保存"}
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
