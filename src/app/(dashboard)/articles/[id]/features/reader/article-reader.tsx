"use client";

import { useRef } from "react";
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

  return (
    <>
      <div
        className="mx-auto px-8 py-6"
        style={{ maxWidth: `${maxWidth}px` }}
      >
        <MetaHeader article={article} />

        <Separator className="my-5" />

        <div ref={contentRef}>
          <article
            className={cn(
              "prose dark:prose-invert max-w-none",
              lineHeightClasses[appearance.lineHeight],
              fontFamilyClasses[appearance.fontFamily]
            )}
            style={{ fontSize: `${appearance.fontSize}px` }}
            dangerouslySetInnerHTML={{ __html: article.body ?? "" }}
          />
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
