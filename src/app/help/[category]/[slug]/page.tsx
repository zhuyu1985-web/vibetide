import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote-client/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeShiki from "@shikijs/rehype";
import { transformerNotationDiff } from "@shikijs/transformers";
import { getDocBySlug, listAllDocs, getCategoryMeta } from "@/lib/help/content";
import { HELP_CATEGORY_SLUGS, type HelpCategorySlug } from "@/lib/help/types";
import { DocLayout } from "@/components/help/doc/doc-layout";
import { mdxComponents } from "@/components/help/mdx";

export const dynamic = "force-static";

export async function generateStaticParams() {
  const docs = await listAllDocs();
  return docs.map((d) => ({ category: d.category, slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  if (!HELP_CATEGORY_SLUGS.includes(category as HelpCategorySlug)) return {};
  const doc = await getDocBySlug(category as HelpCategorySlug, slug);
  if (!doc) return {};
  return { title: doc.frontmatter.title, description: doc.frontmatter.description };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  if (!HELP_CATEGORY_SLUGS.includes(category as HelpCategorySlug)) notFound();
  const cat = category as HelpCategorySlug;

  const doc = await getDocBySlug(cat, slug);
  if (!doc) notFound();

  let meta;
  try {
    meta = await getCategoryMeta(cat);
  } catch {
    notFound();
  }

  return (
    <DocLayout category={cat} meta={meta} doc={doc}>
      <MDXRemote
        source={doc.body}
        components={mdxComponents}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [
              [
                rehypeShiki,
                {
                  themes: {
                    light: "github-light",
                    dark: "github-dark-dimmed",
                  },
                  transformers: [transformerNotationDiff()],
                },
              ],
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: "wrap" }],
            ],
          },
        }}
      />
    </DocLayout>
  );
}
