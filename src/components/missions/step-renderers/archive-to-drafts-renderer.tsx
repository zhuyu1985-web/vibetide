"use client";

import Link from "next/link";
import { SourceUrlPill } from "@/components/shared/source-url-pill";

export interface ArchiveCreatedItem {
  articleId: string;
  title: string;
  sourceUrl?: string;
}

export interface ArchiveSkippedItem {
  sourceUrl: string;
  existingArticleId: string;
  reason: string;
}

export interface ArchiveToDraftsOutput {
  totalRequested?: number;
  totalCreated?: number;
  totalSkipped?: number;
  created?: ArchiveCreatedItem[];
  skipped?: ArchiveSkippedItem[];
}

interface Props {
  outputData: unknown;
}

/**
 * Pure parsing helper, exported for unit testing.
 * 识别 outputData 是不是 archive_to_drafts 输出 shape，是则返回结构化对象；否则 null。
 * 至少有以下任一字段才认：totalRequested / totalCreated / totalSkipped / created / skipped
 */
export function extractArchiveData(outputData: unknown): ArchiveToDraftsOutput | null {
  if (!outputData || typeof outputData !== "object") return null;
  const obj = outputData as ArchiveToDraftsOutput;
  if (
    "totalRequested" in obj ||
    "totalCreated" in obj ||
    "totalSkipped" in obj ||
    "created" in obj ||
    "skipped" in obj
  ) {
    return obj;
  }
  return null;
}

export function ArchiveToDraftsRenderer({ outputData }: Props) {
  const data = extractArchiveData(outputData);
  if (data === null) return null; // 让上层 fallback / generic 处理

  return (
    <div className="space-y-2 pt-2 border-t border-muted/40">
      <div className="text-xs text-muted-foreground">
        本次提交 {data.totalRequested ?? 0} 篇，新建 {data.totalCreated ?? 0} 篇，去重跳过 {data.totalSkipped ?? 0} 篇
      </div>
      {(data.created ?? []).map((c) => (
        <div key={c.articleId} className="flex items-center justify-between p-2 rounded bg-muted/30 gap-2">
          <Link
            href={`/articles/${c.articleId}`}
            className="text-sm font-medium truncate hover:text-blue-600 flex-1 min-w-0"
          >
            {c.title}
          </Link>
          <SourceUrlPill url={c.sourceUrl} variant="compact" />
        </div>
      ))}
      {(data.skipped ?? []).length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            查看 {data.skipped!.length} 篇去重跳过
          </summary>
          <div className="space-y-1 pt-1">
            {data.skipped!.map((s) => (
              <div key={s.sourceUrl} className="flex items-center gap-2 py-1">
                <span className="text-muted-foreground">已存在</span>
                <Link href={`/articles/${s.existingArticleId}`} className="text-blue-600 hover:text-blue-700">
                  查看现有稿件
                </Link>
                <SourceUrlPill url={s.sourceUrl} variant="compact" />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
