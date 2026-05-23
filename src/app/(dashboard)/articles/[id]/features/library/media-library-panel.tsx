"use client";

/**
 * 左栏「资源库」面板。
 *
 * 选当前 org 的媒资素材（图/视频/音频/文档），点击即插入到 Tiptap 编辑器光标处。
 * 通过 store 拿 editorInstance 调用 editor.chain().setImage / insertContent。
 *
 * 复用现有 server action `fetchMoreAssets()` 拉数据，
 * 复用现有媒资 DAL 的 PaginatedAssets / MediaAssetFull 类型。
 */

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Search, Image as ImageIcon, Video, Music, FileText, Loader2 } from "lucide-react";
import { fetchMoreAssets } from "@/app/actions/assets";
import { useArticlePageStore } from "../../store";
import { cn } from "@/lib/utils";
import type { MediaAssetFull } from "@/lib/types";

const TYPE_FILTERS = [
  { key: "all", label: "全部", icon: FileText },
  { key: "image", label: "图片", icon: ImageIcon },
  { key: "video", label: "视频", icon: Video },
  { key: "audio", label: "音频", icon: Music },
] as const;

export function MediaLibraryPanel() {
  const editor = useArticlePageStore((s) => s.editorInstance);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<MediaAssetFull[]>([]);
  const [loading, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await fetchMoreAssets(
            "personal",
            null,
            1,
            30,
            search || undefined,
            typeFilter,
          );
          setItems(result.items);
        } catch {
          setItems([]);
        }
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [typeFilter, search]);

  const handleInsert = (asset: MediaAssetFull) => {
    if (!editor) {
      toast.warning("编辑器未就绪，请先点「编辑」进入编辑模式");
      return;
    }
    const url = asset.thumbnailUrl;
    if (!url) {
      toast.error(`「${asset.title}」无可用 URL`);
      return;
    }

    if (asset.type === "image") {
      editor.chain().focus().setImage({ src: url }).run();
    } else {
      // 视频 / 音频 / 文档 暂用 link 占位（插入视频/音频 node 留到独立 phase）
      editor
        .chain()
        .focus()
        .insertContent(
          `<p><a href="${url}" target="_blank" rel="noopener noreferrer">${asset.title}</a></p>`,
        )
        .run();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search + type filter */}
      <div className="px-3 py-2 border-b border-[var(--glass-border)] space-y-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索素材…"
            className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-md bg-muted/30 dark:bg-white/5 outline-none focus:ring-2 focus:ring-blue-400/30"
          />
        </div>
        <div className="flex gap-1">
          {TYPE_FILTERS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded-md text-[11px] transition-colors",
                  typeFilter === t.key
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium"
                    : "text-muted-foreground hover:bg-muted/30 dark:hover:bg-white/5",
                )}
              >
                <Icon className="h-3 w-3" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            未找到匹配素材
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {items.map((asset) => (
              <button
                key={asset.id}
                onClick={() => handleInsert(asset)}
                title={`点击插入：${asset.title}`}
                className="relative group rounded-md overflow-hidden bg-muted/20 dark:bg-white/5 hover:ring-2 hover:ring-blue-400/40 transition-all"
              >
                {asset.thumbnailUrl && asset.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.title}
                    className="w-full aspect-square object-cover"
                  />
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center text-muted-foreground">
                    {asset.type === "video" ? (
                      <Video className="h-6 w-6" />
                    ) : asset.type === "audio" ? (
                      <Music className="h-6 w-6" />
                    ) : (
                      <FileText className="h-6 w-6" />
                    )}
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] truncate text-left">
                  {asset.title}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
