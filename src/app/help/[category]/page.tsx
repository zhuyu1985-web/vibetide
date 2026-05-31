import { notFound } from "next/navigation";
import { listDocsByCategory, getCategoryMeta } from "@/lib/help/content";
import { HELP_CATEGORY_SLUGS, type HelpCategorySlug } from "@/lib/help/types";
import { Breadcrumb } from "@/components/help/doc/doc-breadcrumb";
import { CategoryHero } from "@/components/help/category/category-hero";
import { DocList } from "@/components/help/category/doc-list";

export const dynamic = "force-static";

export async function generateStaticParams() {
  return HELP_CATEGORY_SLUGS.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!HELP_CATEGORY_SLUGS.includes(category as HelpCategorySlug)) return {};
  try {
    const meta = await getCategoryMeta(category as HelpCategorySlug);
    return { title: meta.title, description: meta.description };
  } catch {
    return {};
  }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  if (!HELP_CATEGORY_SLUGS.includes(category as HelpCategorySlug)) notFound();
  const cat = category as HelpCategorySlug;

  let meta;
  try {
    meta = await getCategoryMeta(cat);
  } catch {
    notFound();
  }

  const docs = await listDocsByCategory(cat);

  // 计算分类下最新更新时间(优先 updatedAt,无则用 publishedAt)
  const lastUpdated = docs.reduce<string | undefined>((latest, d) => {
    const date = d.frontmatter.updatedAt ?? d.frontmatter.publishedAt;
    if (!latest || date > latest) return date;
    return latest;
  }, undefined);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumb
        segments={[
          { label: "帮助中心", href: "/help" },
          { label: meta.title },
        ]}
      />
      <CategoryHero meta={meta} docCount={docs.length} lastUpdated={lastUpdated} />
      <DocList category={cat} meta={meta} docs={docs} />
    </div>
  );
}
