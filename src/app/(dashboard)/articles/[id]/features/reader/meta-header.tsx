"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import type { ArticleDetail } from "@/lib/types";

interface MetaHeaderProps {
  article: ArticleDetail;
}

export function MetaHeader({ article }: MetaHeaderProps) {
  const [tags, setTags] = useState<string[]>(article.tags ?? []);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  const readTimeMinutes = Math.max(1, Math.round((article.wordCount ?? 0) / 500));

  const displayDate = article.publishedAt ?? article.createdAt;
  const formattedDate = displayDate
    ? new Date(displayDate).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "";

  const commitTag = () => {
    const t = draft.trim();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setDraft("");
    setIsAdding(false);
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-3">
      {/* Title */}
      <h1 className="text-2xl font-bold text-foreground leading-tight">
        {article.title}
      </h1>

      {/* Source info line */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
        <span>{article.assigneeName ?? "未知来源"}</span>
        {formattedDate && (
          <>
            <span className="text-border">|</span>
            <span>{formattedDate}</span>
          </>
        )}
        <span className="text-border">|</span>
        <span>{readTimeMinutes} 分钟阅读</span>
        {(article.wordCount ?? 0) > 0 && (
          <>
            <span className="text-border">|</span>
            <span>{article.wordCount!.toLocaleString()} 字</span>
          </>
        )}
        {article.sourceUrl && (
          <>
            <span className="text-border">|</span>
            <SourceUrlPill url={article.sourceUrl} variant="default" />
          </>
        )}
      </div>

      {/* Tags —— 内联交互：点 + 标签 出现 input，回车保存 / ESC 取消 / 失焦保存 */}
      <div className="flex items-center gap-2 flex-wrap">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="text-xs gap-1 pr-1"
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="rounded-full hover:bg-foreground/10 p-0.5 transition-colors"
              aria-label={`移除标签 ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        {isAdding ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTag();
              } else if (e.key === "Escape") {
                setDraft("");
                setIsAdding(false);
              }
            }}
            onBlur={commitTag}
            placeholder="输入标签后回车"
            className="h-6 px-2 rounded-full text-xs bg-muted/60 border border-border focus:outline-none focus:ring-2 focus:ring-blue-500/40 min-w-[120px]"
          />
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <Plus className="h-3 w-3" />
            标签
          </button>
        )}
      </div>
    </div>
  );
}
