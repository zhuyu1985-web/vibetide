"use client";

import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  Brain,
  Clapperboard,
  ScrollText,
  XCircle,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** URL 导入里程碑卡片的 meta 形状（各 Inngest 函数追加消息时写入）。 */
export interface ImportCardMeta {
  stage?:
    | "queued"
    | "ingested"
    | "analyzed"
    | "video_stored"
    | "understood"
    | "failed";
  articleId?: string;
  assetId?: string;
  title?: string;
  summary?: string;
  sourceUrl?: string;
  mediaType?: "article" | "video";
  urls?: string[];
}

const STAGE_STYLE: Record<
  NonNullable<ImportCardMeta["stage"]>,
  { icon: LucideIcon; tint: string; spin?: boolean }
> = {
  queued: { icon: Loader2, tint: "text-muted-foreground", spin: true },
  ingested: { icon: CheckCircle2, tint: "text-emerald-500" },
  analyzed: { icon: Brain, tint: "text-primary" },
  video_stored: { icon: Clapperboard, tint: "text-violet-500" },
  understood: { icon: ScrollText, tint: "text-sky-500" },
  failed: { icon: XCircle, tint: "text-destructive" },
};

export function ImportCard({
  content,
  meta,
}: {
  content: string;
  meta: ImportCardMeta | null;
}) {
  const stage = meta?.stage ?? "queued";
  const { icon: Icon, tint, spin } = STAGE_STYLE[stage];

  return (
    <div className="flex max-w-[88%] flex-col gap-1.5 rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 shadow-sm ring-1 ring-inset ring-border/60">
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4 flex-none", tint, spin && "animate-spin")} />
        <span className="text-[13px] leading-relaxed text-foreground">
          {content}
        </span>
      </div>

      {meta?.summary && (
        <p className="line-clamp-3 pl-6 text-[12px] leading-relaxed text-muted-foreground">
          {meta.summary}
        </p>
      )}

      {meta?.articleId && (
        <Link
          href={`/articles/${meta.articleId}`}
          className="ml-6 inline-flex w-fit items-center gap-0.5 text-[12px] font-medium text-primary hover:underline"
        >
          查看稿件 <ArrowUpRight className="size-3" />
        </Link>
      )}
    </div>
  );
}
