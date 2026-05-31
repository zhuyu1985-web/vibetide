import { MDXRemote } from "next-mdx-remote-client/rsc";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/help/mdx";
import type { ChangelogEntry } from "@/lib/help/changelog";

export function ChangelogMonth({
  entry,
  defaultOpen,
}: {
  entry: ChangelogEntry;
  defaultOpen: boolean;
}) {
  return (
    <details
      id={entry.slug}
      className="group border-b border-border/60 py-6 scroll-mt-20"
      open={defaultOpen}
    >
      <summary className="flex items-baseline gap-3 cursor-pointer list-none">
        <span className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-mono">
          {entry.frontmatter.version}
        </span>
        <h2 className="text-lg font-semibold text-foreground">{entry.frontmatter.title}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{entry.frontmatter.publishedAt}</span>
      </summary>
      <p className="mt-3 text-sm text-muted-foreground">{entry.frontmatter.summary}</p>
      <div className="mt-4 prose prose-sm dark:prose-invert max-w-none">
        <MDXRemote
          source={entry.body}
          components={mdxComponents}
          options={{ mdxOptions: { remarkPlugins: [remarkGfm] } }}
        />
      </div>
    </details>
  );
}
