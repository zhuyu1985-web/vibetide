import Link from "next/link";
import { GlassCard } from "@/components/shared/glass-card";
import { CategoryIcon } from "./category-icon";
import type { HelpCategorySummary } from "@/lib/help/types";

interface CategoryGridProps {
  summaries: HelpCategorySummary[];
}

export function CategoryGrid({ summaries }: CategoryGridProps) {
  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <h2 className="text-xl font-semibold text-foreground mb-6">浏览主题</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaries.map(({ slug, meta, docCount }) => (
          <Link key={slug} href={`/help/${slug}`} className="group">
            <GlassCard hover className="h-full">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-300">
                  <CategoryIcon name={meta.icon} className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-sky-700 dark:group-hover:text-sky-300">
                    {meta.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {meta.description}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground/80">
                    {docCount} 篇文档
                  </p>
                </div>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
