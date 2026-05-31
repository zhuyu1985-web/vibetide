import { notFound } from "next/navigation";
import { getDocBySlug, listAllDocs, getCategoryMeta } from "@/lib/help/content";
import { HELP_CATEGORY_SLUGS, type HelpCategorySlug } from "@/lib/help/types";
import { DocLayout } from "@/components/help/doc/doc-layout";

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
      {/* Phase 5.2 替换为 <MDXRemote source={doc.body} components={mdxComponents} /> */}
      <pre className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg">
        {doc.body}
      </pre>
    </DocLayout>
  );
}
