import Link from "next/link";
import type { HelpCategoryMeta, HelpCategorySlug, HelpDoc } from "@/lib/help/types";

interface DocListProps {
  category: HelpCategorySlug;
  meta: HelpCategoryMeta;
  docs: HelpDoc[];
}

export function DocList({ category, meta, docs }: DocListProps) {
  return (
    <div>
      {meta.groups.map((group) => (
        <div key={group.title} className="mb-8">
          <h3 className="text-sm font-semibold text-foreground mb-3">{group.title}</h3>
          <ul className="space-y-2">
            {group.docs.map((slug) => {
              const doc = docs.find((d) => d.slug === slug);
              if (!doc) return null;
              return (
                <li key={slug}>
                  <Link
                    href={`/help/${category}/${slug}`}
                    className="block p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="text-sm font-medium text-foreground group-hover:text-sky-700 dark:group-hover:text-sky-300">
                      {doc.frontmatter.title}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {doc.frontmatter.description}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
