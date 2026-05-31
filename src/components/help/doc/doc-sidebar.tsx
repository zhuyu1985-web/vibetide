import Link from "next/link";
import { listDocsByCategory } from "@/lib/help/content";
import { cn } from "@/lib/utils";
import type { HelpCategoryMeta, HelpCategorySlug } from "@/lib/help/types";

interface DocSidebarProps {
  category: HelpCategorySlug;
  meta: HelpCategoryMeta;
  currentSlug: string;
}

export async function DocSidebar({ category, meta, currentSlug }: DocSidebarProps) {
  // server component 自己拉 docs;React cache 会与 page.tsx 去重
  const docs = await listDocsByCategory(category);
  const titleBySlug = new Map(docs.map((d) => [d.slug, d.frontmatter.title]));

  return (
    <aside className="hidden lg:block sticky top-14 h-[calc(100svh-3.5rem)] overflow-y-auto py-8 pr-4">
      <p className="px-2 mb-4 text-sm font-semibold text-foreground">{meta.title}</p>
      {meta.groups.map((g) => (
        <div key={g.title} className="mb-4">
          <p className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            {g.title}
          </p>
          <ul className="space-y-0.5">
            {g.docs.map((slug) => {
              const active = slug === currentSlug;
              const title = titleBySlug.get(slug) ?? slug;
              return (
                <li key={slug}>
                  <Link
                    href={`/help/${category}/${slug}`}
                    className={cn(
                      "block px-2 py-1.5 rounded-md text-[13px] transition-colors",
                      active
                        ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-medium"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
