import { FileText, Clock } from "lucide-react";
import { CategoryIcon } from "@/components/help/home/category-icon";
import type { HelpCategoryMeta } from "@/lib/help/types";

interface CategoryHeroProps {
  meta: HelpCategoryMeta;
  docCount: number;
  lastUpdated?: string;
}

export function CategoryHero({ meta, docCount, lastUpdated }: CategoryHeroProps) {
  return (
    <header className="mb-10">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-300">
          <CategoryIcon name={meta.icon} className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-foreground">{meta.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{meta.description}</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileText size={12} />
              {docCount} 篇文档
            </span>
            {lastUpdated && (
              <span className="flex items-center gap-1.5">
                <Clock size={12} />
                最近更新 {lastUpdated}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
