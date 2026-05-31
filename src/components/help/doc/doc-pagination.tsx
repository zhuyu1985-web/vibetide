import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { listDocsByCategory } from "@/lib/help/content";
import type { HelpCategoryMeta, HelpCategorySlug } from "@/lib/help/types";

interface DocPaginationProps {
  category: HelpCategorySlug;
  meta: HelpCategoryMeta;
  currentSlug: string;
}

export async function DocPagination({ category, meta, currentSlug }: DocPaginationProps) {
  const flat = meta.groups.flatMap((g) => g.docs);
  const idx = flat.indexOf(currentSlug);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  if (!prev && !next) return null;

  // 共享 page.tsx 的 listDocsByCategory cache 拿到 title
  const docs = await listDocsByCategory(category);
  const titleBySlug = new Map(docs.map((d) => [d.slug, d.frontmatter.title]));

  return (
    <nav
      aria-label="上下篇导航"
      className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {prev ? (
        <Link
          href={`/help/${category}/${prev}`}
          className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group"
        >
          <ChevronLeft size={16} className="shrink-0 text-muted-foreground group-hover:text-foreground" />
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">上一篇</div>
            <div className="text-sm font-medium text-foreground truncate">
              {titleBySlug.get(prev) ?? prev}
            </div>
          </div>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/help/${category}/${next}`}
          className="flex items-center justify-end gap-3 p-4 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group text-right"
        >
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground">下一篇</div>
            <div className="text-sm font-medium text-foreground truncate">
              {titleBySlug.get(next) ?? next}
            </div>
          </div>
          <ChevronRight size={16} className="shrink-0 text-muted-foreground group-hover:text-foreground" />
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
