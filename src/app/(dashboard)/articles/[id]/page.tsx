import { getArticle } from "@/lib/dal/articles";
import { getCategories } from "@/lib/dal/categories";
import { getChannelAdvisors } from "@/lib/dal/channel-advisors";
import ArticleEditClient from "./article-edit-client";
import { notFound } from "next/navigation";

export default async function ArticleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [article, categories, advisors] = await Promise.all([
    getArticle(id).catch(() => null),
    getCategories().catch(() => []),
    getChannelAdvisors().catch(() => []),
  ]);

  if (!article) notFound();

  return <ArticleEditClient article={article} categories={categories} advisors={advisors} />;
}
