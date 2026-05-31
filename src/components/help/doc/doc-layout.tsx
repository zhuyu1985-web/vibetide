import { Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/help/doc/doc-breadcrumb";
import { DocSidebar } from "@/components/help/doc/doc-sidebar";
import { DocToc } from "@/components/help/doc/doc-toc";
import { DocFeedback } from "@/components/help/doc/doc-feedback";
import { DocPagination } from "@/components/help/doc/doc-pagination";
import type {
  HelpCategoryMeta,
  HelpCategorySlug,
  HelpDocWithBody,
} from "@/lib/help/types";

interface DocLayoutProps {
  category: HelpCategorySlug;
  meta: HelpCategoryMeta;
  doc: HelpDocWithBody;
  children: React.ReactNode;
}

export function DocLayout({ category, meta, doc, children }: DocLayoutProps) {
  const hasToc = doc.toc.length > 0 && doc.frontmatter.toc !== false;
  const docPath = `/help/${category}/${doc.slug}`;
  const updateDate = doc.frontmatter.updatedAt ?? doc.frontmatter.publishedAt;

  return (
    <div className="max-w-7xl mx-auto px-4">
      <div
        className={cn(
          "grid grid-cols-1 gap-8",
          hasToc
            ? "lg:grid-cols-[240px_minmax(0,1fr)_240px]"
            : "lg:grid-cols-[240px_minmax(0,1fr)]"
        )}
      >
        <DocSidebar category={category} meta={meta} currentSlug={doc.slug} />

        <article
          className={cn(
            "py-8 mx-auto w-full",
            hasToc ? "max-w-3xl" : "max-w-4xl"
          )}
        >
          <Breadcrumb
            segments={[
              { label: "帮助中心", href: "/help" },
              { label: meta.title, href: `/help/${category}` },
              { label: doc.frontmatter.title },
            ]}
          />
          <h1 className="text-3xl font-semibold text-foreground tracking-tight">
            {doc.frontmatter.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {doc.frontmatter.description}
          </p>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground/80">
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              {doc.readingTime}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={12} />
              更新于 {updateDate}
            </span>
          </div>

          <div className="mt-8 prose prose-sm dark:prose-invert max-w-none">
            {children}
          </div>

          <DocFeedback docPath={docPath} />
          <DocPagination category={category} meta={meta} currentSlug={doc.slug} />
        </article>

        {hasToc && (
          <aside className="hidden lg:block sticky top-14 h-[calc(100svh-3.5rem)] overflow-y-auto py-8 pl-4">
            <DocToc entries={doc.toc} />
          </aside>
        )}
      </div>
    </div>
  );
}
