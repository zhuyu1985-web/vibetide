"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  getArticleDetailBundle,
  type ArticleDetailBundle,
} from "@/app/actions/article-bundle";
import { useArticlePageStore } from "@/app/(dashboard)/articles/[id]/store";

// 动态加载整页文章编辑器（Tiptap + 多 panel 很重），仅在 Sheet 打开时才进包，
// 避免拖累 cowork 初始 bundle。
const ArticleDetailClient = dynamic(
  () => import("@/app/(dashboard)/articles/[id]/article-detail-client"),
  { ssr: false },
);

/**
 * 在 cowork 右侧宽 Sheet 内打开完整文章编辑器（嵌入模式，三栏左右布局），
 * 替代「跳整页 /articles/[id]」。复用 ArticleDetailClient + getArticleDetailBundle。
 */
export function ArticleEditorSheet({
  articleId,
  open,
  onOpenChange,
}: {
  articleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [bundle, setBundle] = useState<ArticleDetailBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(false);
    setBundle(null);
    // 单例 store：开 Sheet 前重置上一篇残留的瞬态（编辑器实例 / handlers / 选区）。
    const s = useArticlePageStore.getState();
    s.setEditorInstance(null);
    s.setEditorHandlers(null);
    s.setSelectedText(null);
    getArticleDetailBundle(articleId)
      .then((b) => {
        if (!active) return;
        if (b) setBundle(b);
        else setError(true);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, articleId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[94vw] gap-0 p-0 sm:max-w-[1480px]"
      >
        <SheetTitle className="sr-only">稿件深度编辑</SheetTitle>
        {loading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> 正在加载编辑器…
          </div>
        )}
        {error && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <p>编辑器加载失败</p>
            <Link
              href={`/articles/${articleId}`}
              className="text-primary underline"
            >
              在新页面打开
            </Link>
          </div>
        )}
        {bundle && !loading && (
          <ArticleDetailClient
            {...bundle}
            embedded
            initialViewMode="edit"
            onExitEditor={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
