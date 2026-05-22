"use client";

/**
 * 右栏「基本信息」面板。
 *
 * 展示并编辑稿件的基础元数据：作者 / 来源 / 摘要 / 关键词 /
 * 列表样式 / 封面图 / 分享图。
 *
 * 调用 server action `updateArticle()`（已存在）做持久化；
 * 摘要等编辑器正文以外的字段直接发，不走 editor 流程。
 */

import { useState, useTransition } from "react";
import { updateArticle } from "@/app/actions/articles";
import { cn } from "@/lib/utils";

const LIST_STYLE_OPTIONS = [
  { value: "default", label: "默认" },
  { value: "single_image", label: "单图" },
  { value: "multi_image", label: "多图" },
  { value: "title", label: "标题" },
  { value: "narrow", label: "窄图" },
  { value: "seamless", label: "无缝" },
] as const;

interface ArticleInfoPanelProps {
  articleId: string;
  initial: {
    authorName?: string;
    sourceName?: string;
    summary?: string;
    keywords?: string[];
    coverImageUrl?: string;
    shareImageUrl?: string;
    listStyle?: string;
  };
}

export function ArticleInfoPanel({ articleId, initial }: ArticleInfoPanelProps) {
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [keywordsRaw, setKeywordsRaw] = useState((initial.keywords ?? []).join(" "));
  const [coverUrl, setCoverUrl] = useState(initial.coverImageUrl ?? "");
  const [shareUrl, setShareUrl] = useState(initial.shareImageUrl ?? "");
  const [listStyle, setListStyle] = useState(initial.listStyle ?? "default");
  const [pending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const handleSave = () => {
    const keywords = keywordsRaw
      .split(/[\s,，]+/)
      .map((w) => w.trim())
      .filter(Boolean);

    startTransition(async () => {
      try {
        await updateArticle(articleId, {
          summary: summary || undefined,
          keywords,
          coverImageUrl: coverUrl || null,
          shareImageUrl: shareUrl || null,
          listStyle: listStyle || null,
        });
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 2500);
      }
    });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <SectionLabel>作者</SectionLabel>
      <div className="text-sm text-foreground">
        {initial.authorName || <span className="text-muted-foreground">未设置</span>}
      </div>

      <SectionLabel>来源</SectionLabel>
      <div className="text-sm text-foreground">
        {initial.sourceName || <span className="text-muted-foreground">原创</span>}
      </div>

      <SectionLabel>摘要</SectionLabel>
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="请输入摘要（≤255 字）"
        rows={4}
        maxLength={255}
        className="resize-none rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/30"
      />
      <div className="text-right text-[10px] text-muted-foreground -mt-2">
        {summary.length} / 255
      </div>

      <SectionLabel>关键词</SectionLabel>
      <input
        type="text"
        value={keywordsRaw}
        onChange={(e) => setKeywordsRaw(e.target.value)}
        placeholder="多个关键词用空格 / 逗号分隔"
        className="rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/30"
      />

      <SectionLabel>列表样式</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {LIST_STYLE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setListStyle(opt.value)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs transition-colors",
              listStyle === opt.value
                ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                : "bg-muted/30 dark:bg-white/5 text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <SectionLabel>封面图 URL</SectionLabel>
      <input
        type="url"
        value={coverUrl}
        onChange={(e) => setCoverUrl(e.target.value)}
        placeholder="https://..."
        className="rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/30"
      />

      <SectionLabel>分享图 URL</SectionLabel>
      <input
        type="url"
        value={shareUrl}
        onChange={(e) => setShareUrl(e.target.value)}
        placeholder="https://..."
        className="rounded-lg bg-muted/30 dark:bg-white/5 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400/30"
      />

      <button
        onClick={handleSave}
        disabled={pending}
        className={cn(
          "mt-2 h-9 rounded-lg text-sm font-medium transition-colors",
          pending
            ? "bg-muted/40 text-muted-foreground"
            : "bg-blue-500 text-white hover:bg-blue-600",
        )}
      >
        {pending ? "保存中…" : saveStatus === "saved" ? "已保存 ✓" : saveStatus === "error" ? "保存失败" : "保存信息"}
      </button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11px] font-medium text-muted-foreground tracking-wider -mb-2">
      {children}
    </label>
  );
}
