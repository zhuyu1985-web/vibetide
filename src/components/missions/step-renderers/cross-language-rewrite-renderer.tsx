"use client";

import { useMemo } from "react";
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import { FallbackRenderer } from "./fallback-renderer";

export interface RewrittenArticle {
  id: string;
  sourceTopicId?: string;
  variantIndex?: number;
  sourceUrl?: string;
  category?: string;
  title_en: string;
  body_en: string;
  hashtags: string[];
  cultural_notes?: string;
}

interface Props {
  outputData: unknown;
}

/**
 * Pure parsing helper, exported for unit testing.
 * 提取 outputData.articles 数组（RewrittenArticle[]）。
 * 不是 articles 数组形态时返回 null（让 caller fallback）。
 */
export function extractRewrittenArticles(outputData: unknown): RewrittenArticle[] | null {
  if (!outputData || typeof outputData !== "object") return null;
  const obj = outputData as Record<string, unknown>;
  if (!Array.isArray(obj.articles)) return null;
  return obj.articles as RewrittenArticle[];
}

export function CrossLanguageRewriteRenderer({ outputData }: Props) {
  const articles = useMemo(() => extractRewrittenArticles(outputData), [outputData]);

  if (articles === null) {
    return <FallbackRenderer outputData={outputData} reason="无法解析 cross_language_rewrite 输出" />;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        翻译改写 {articles.length} 篇英文稿件
      </div>
      {articles.map((a) => (
        <details key={a.id} className="rounded bg-muted/30 p-3">
          <summary className="cursor-pointer flex items-center gap-2">
            <code className="text-xs">{a.id}</code>
            {a.category && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                {a.category}
              </span>
            )}
            <span className="text-sm font-medium flex-1 truncate">{a.title_en}</span>
            <SourceUrlPill url={a.sourceUrl} variant="compact" />
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Body (EN)</h5>
              <pre className="whitespace-pre-wrap text-sm">{a.body_en}</pre>
            </div>
            {a.hashtags && a.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {a.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {a.cultural_notes && (
              <div className="text-xs text-muted-foreground italic border-l-2 border-amber-300 pl-2">
                Cultural notes: {a.cultural_notes}
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
