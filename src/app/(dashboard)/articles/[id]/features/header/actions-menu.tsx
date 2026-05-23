"use client";

/**
 * 「更多操作」菜单 —— 严格按用户指定的菜单结构（2026-05-23）：
 *   - 分享阅读
 *   - 访问原始网页
 *   - 快照
 *   - 复制链接 ▸ 复制原链接 / 复制 Markdown 链接
 *   - 复制内容 ▸ 复制内容为文本 / Markdown / HTML / 复制快照为 HTML
 *   - 导出     ▸ 导出内容为 TXT / Markdown / HTML / PDF / 导出快照为 HTML
 *   - 收藏
 *   - 移动     ▸ 设置分类栏目（动态列出 categories）
 *   - 归档
 *   - 删除（红色，二次确认）
 *
 * 用 shadcn DropdownMenuSub 实现二级菜单。
 */

import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Share2,
  Globe,
  Camera,
  Link2,
  Copy,
  Download,
  Star,
  FolderInput,
  Archive,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  deleteArticle,
  batchUpdateArticleStatus,
  batchMoveArticlesToCategory,
} from "@/app/actions/articles";
import { getCategories } from "@/lib/dal/categories";
import type { CategoryNode } from "@/lib/types";

interface ActionsMenuProps {
  articleId: string;
  articleUrl?: string;
  /** 显式触发器；不传时挂在右上角 More Horizontal icon 上 */
  children?: React.ReactNode;
}

function flatCategories(nodes: CategoryNode[], depth = 0): { id: string; name: string; depth: number }[] {
  const out: { id: string; name: string; depth: number }[] = [];
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, depth });
    if (n.children?.length) out.push(...flatCategories(n.children, depth + 1));
  }
  return out;
}

function showToast(msg: string) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.cssText =
    "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:hsl(var(--popover));border:1px solid hsl(var(--border));color:hsl(var(--foreground));padding:8px 16px;border-radius:8px;font-size:12px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.15);pointer-events:none;";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function getArticleText(): string {
  const bodyEl = document.querySelector("[data-article-body]");
  return bodyEl?.textContent ?? document.body.innerText ?? "";
}

function getArticleHtml(): string {
  const bodyEl = document.querySelector("[data-article-body]");
  return bodyEl?.innerHTML ?? "";
}

function htmlToMarkdown(html: string): string {
  // 极简 HTML → Markdown 转换（h1/h2/p/b/i/li/a/img）
  // 完整实现可接 turndown 库，phase 3 再升级
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, "![$2]($1)")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function downloadAs(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ActionsMenu({ articleId, articleUrl, children }: ActionsMenuProps) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);

  // 懒加载 categories（移到栏目子菜单用）
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // ── 分享 & 访问 ──
  const handleShare = () => {
    if (navigator.share && articleUrl) {
      navigator.share({ url: articleUrl, title: "分享稿件" }).catch(() => undefined);
    } else if (articleUrl) {
      navigator.clipboard.writeText(articleUrl).then(() => showToast("链接已复制，可分享"));
    } else {
      showToast("当前稿件无外链，无法分享");
    }
  };

  const handleOpenUrl = () => {
    if (articleUrl) {
      window.open(articleUrl, "_blank", "noopener,noreferrer");
    } else {
      showToast("暂无原始链接");
    }
  };

  const handleSnapshot = () => {
    showToast("快照功能即将上线");
  };

  // ── 复制链接 ──
  const handleCopyUrl = () => {
    if (articleUrl) {
      navigator.clipboard.writeText(articleUrl).then(() => showToast("链接已复制"));
    } else {
      showToast("暂无原始链接");
    }
  };

  const handleCopyMarkdownLink = () => {
    if (articleUrl) {
      const title = document.title || "稿件";
      navigator.clipboard
        .writeText(`[${title}](${articleUrl})`)
        .then(() => showToast("Markdown 链接已复制"));
    } else {
      showToast("暂无原始链接");
    }
  };

  // ── 复制内容 ──
  const handleCopyAsText = () => {
    navigator.clipboard.writeText(getArticleText()).then(() => showToast("正文（纯文本）已复制"));
  };

  const handleCopyAsMarkdown = () => {
    const md = htmlToMarkdown(getArticleHtml());
    navigator.clipboard.writeText(md).then(() => showToast("Markdown 已复制"));
  };

  const handleCopyAsHtml = () => {
    navigator.clipboard.writeText(getArticleHtml()).then(() => showToast("HTML 已复制"));
  };

  const handleCopySnapshotHtml = () => {
    showToast("快照 HTML 复制即将上线");
  };

  // ── 导出 ──
  const handleExportTxt = () => {
    downloadAs("article.txt", getArticleText(), "text/plain;charset=utf-8");
  };

  const handleExportMarkdown = () => {
    const md = htmlToMarkdown(getArticleHtml());
    downloadAs("article.md", md, "text/markdown;charset=utf-8");
  };

  const handleExportHtml = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>稿件</title></head><body>${getArticleHtml()}</body></html>`;
    downloadAs("article.html", html, "text/html;charset=utf-8");
  };

  const handleExportPdf = () => {
    showToast("PDF 导出即将上线（需 server-side puppeteer）");
  };

  const handleExportSnapshotHtml = () => {
    showToast("快照 HTML 导出即将上线");
  };

  // ── 整理 ──
  const handleFavorite = () => {
    showToast("收藏功能即将上线（绑定 user_saved_articles）");
  };

  const handleMoveTo = async (categoryId: string | null) => {
    setPending(true);
    try {
      await batchMoveArticlesToCategory([articleId], categoryId);
      showToast(categoryId ? "已移到所选栏目" : "已移出栏目");
      router.refresh();
    } catch {
      showToast("移动失败");
    } finally {
      setPending(false);
    }
  };

  const handleArchive = async () => {
    setPending(true);
    try {
      await batchUpdateArticleStatus([articleId], "archived");
      showToast("已归档");
      router.refresh();
    } catch {
      showToast("归档失败");
    } finally {
      setPending(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleteOpen(false);
    setPending(true);
    try {
      await deleteArticle(articleId);
      showToast("已删除");
      router.push("/articles");
    } catch {
      showToast("删除失败");
      setPending(false);
    }
  };

  const flatCats = flatCategories(categories);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleShare}>
          <Share2 className="h-3.5 w-3.5" />
          分享阅读
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleOpenUrl}>
          <Globe className="h-3.5 w-3.5" />
          访问原始网页
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSnapshot}>
          <Camera className="h-3.5 w-3.5" />
          快照
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 复制链接 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Link2 className="h-3.5 w-3.5" />
            复制链接
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={handleCopyUrl}>复制原链接</DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyMarkdownLink}>
              复制 Markdown 链接
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 复制内容 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Copy className="h-3.5 w-3.5" />
            复制内容
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={handleCopyAsText}>复制内容为文本</DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyAsMarkdown}>
              复制内容为 Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyAsHtml}>复制内容为 HTML</DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopySnapshotHtml}>
              复制快照为 HTML
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 导出 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Download className="h-3.5 w-3.5" />
            导出
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={handleExportTxt}>导出内容为 TXT</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportMarkdown}>
              导出内容为 Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportHtml}>导出内容为 HTML</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportPdf}>导出内容为 PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportSnapshotHtml}>
              导出快照为 HTML
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleFavorite}>
          <Star className="h-3.5 w-3.5" />
          收藏
        </DropdownMenuItem>

        {/* 移动到栏目 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderInput className="h-3.5 w-3.5" />
            移动
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
            {flatCats.length === 0 ? (
              <DropdownMenuItem disabled>无可用栏目</DropdownMenuItem>
            ) : (
              flatCats.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => handleMoveTo(c.id)}
                  disabled={pending}
                >
                  <span style={{ paddingLeft: c.depth * 12 }}>{c.name}</span>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleMoveTo(null)} disabled={pending}>
              移出栏目
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onClick={handleArchive} disabled={pending}>
          <Archive className="h-3.5 w-3.5" />
          归档
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => setDeleteOpen(true)}
          disabled={pending}
          className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除稿件"
        description="确定要删除这篇稿件吗？此操作不可撤销，关联的批注、AI 分析、聊天记录将一并清除。"
        confirmText="删除"
        variant="danger"
        onConfirm={handleDeleteConfirm}
      />
    </DropdownMenu>
  );
}
