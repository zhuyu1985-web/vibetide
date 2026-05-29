"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MetaHeader } from "./meta-header";
import { TextSelectionMenu } from "./text-selection-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ArticleDetail } from "@/lib/types";
import type { AppearanceSettings } from "../../types";

interface ArticleReaderProps {
  article: ArticleDetail;
  appearance: AppearanceSettings;
  organizationId?: string;
}

// 检测 body 是否是 HTML：是 → 走 dangerouslySetInnerHTML（兼容老 HTML 稿件 + 外抓稿件）；
// 否 → 当 Markdown 用 ReactMarkdown 渲染（content_generate / layout_design 产物）。
// 启发式：扫常见块级 HTML 标签，命中即认 HTML。空 body 默认 false（走 markdown 路径，渲染空白）。
function looksLikeHtml(body: string): boolean {
  return /<(p|div|h[1-6]|br|ul|ol|li|table|article|section|blockquote|pre|code|figure|img|a)\b[^>]*>/i.test(body);
}

const marginWidths: Record<AppearanceSettings["margins"], number> = {
  narrow: 560,
  standard: 680,
  wide: 800,
};

const lineHeightClasses: Record<AppearanceSettings["lineHeight"], string> = {
  compact: "leading-relaxed",
  comfortable: "leading-loose",
  loose: "[line-height:2.25]",
};

const fontFamilyClasses: Record<AppearanceSettings["fontFamily"], string> = {
  system: "font-sans",
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
};

export function ArticleReader({ article, appearance, organizationId = "" }: ArticleReaderProps) {
  const maxWidth = marginWidths[appearance.margins];
  const contentRef = useRef<HTMLDivElement>(null);

  // Apply native lazy loading to all images in the article body
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const images = container.querySelectorAll("img");
    images.forEach((img) => {
      img.loading = "lazy";
      img.decoding = "async";
    });
  }, [article.body]);

  return (
    <>
      <div
        className="mx-auto px-8 py-6"
        style={{ maxWidth: `${maxWidth}px` }}
      >
        <MetaHeader article={article} />

        <Separator className="my-5" />

        <div ref={contentRef}>
          {looksLikeHtml(article.body ?? "") ? (
            <article
              className={cn(
                "prose dark:prose-invert max-w-none",
                lineHeightClasses[appearance.lineHeight],
                fontFamilyClasses[appearance.fontFamily]
              )}
              style={{ fontSize: `${appearance.fontSize}px` }}
              dangerouslySetInnerHTML={{ __html: article.body ?? "" }}
            />
          ) : (
            <article
              className={cn(
                "prose dark:prose-invert max-w-none",
                lineHeightClasses[appearance.lineHeight],
                fontFamilyClasses[appearance.fontFamily]
              )}
              style={{ fontSize: `${appearance.fontSize}px` }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {article.body ?? ""}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </div>

      <TextSelectionMenu
        articleId={article.id}
        organizationId={organizationId}
        containerRef={contentRef}
      />
    </>
  );
}
