import Link from "next/link";
import { GlassCard } from "@/components/shared/glass-card";
import type { HelpDoc } from "@/lib/help/types";

interface PopularDocsProps {
  docs: HelpDoc[];
}

export function PopularDocs({ docs }: PopularDocsProps) {
  if (docs.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 py-8">
      <h2 className="text-xl font-semibold text-foreground mb-6">热门文档</h2>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {docs.map((doc) => (
          <Link
            key={`${doc.category}/${doc.slug}`}
            href={`/help/${doc.category}/${doc.slug}`}
            className="shrink-0 w-72 group"
          >
            <GlassCard hover className="h-full">
              <h3 className="text-sm font-semibold text-foreground group-hover:text-sky-700 dark:group-hover:text-sky-300 line-clamp-2">
                {doc.frontmatter.title}
              </h3>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                {doc.frontmatter.description}
              </p>
              <div className="mt-3 inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300">
                {doc.category}
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </section>
  );
}
