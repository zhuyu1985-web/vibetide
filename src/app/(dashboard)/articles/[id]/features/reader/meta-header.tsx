"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ArticleDetail } from "@/lib/types";

interface MetaHeaderProps {
  article: ArticleDetail;
}

export function MetaHeader({ article }: MetaHeaderProps) {
  const [tags, setTags] = useState<string[]>(article.tags ?? []);

  const readTimeMinutes = Math.max(1, Math.round((article.wordCount ?? 0) / 500));

  const displayDate = article.publishedAt ?? article.createdAt;
  const formattedDate = displayDate
    ? new Date(displayDate).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "";

  const handleAddTag = () => {
    const tag = window.prompt("输入新标签");
    if (tag && tag.trim() && !tags.includes(tag.trim())) {
      setTags((prev) => [...prev, tag.trim()]);
    }
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
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="text-xs"
          >
            {tag}
          </Badge>
        ))}
        <button
          onClick={handleAddTag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <Plus className="h-3 w-3" />
          标签
        </button>
      </div>
    </div>
  );
}
