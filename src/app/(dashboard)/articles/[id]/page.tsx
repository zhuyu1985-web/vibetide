import { notFound } from "next/navigation";
import { getArticle } from "@/lib/dal/articles";
import ArticleDetailClient from "./article-detail-client";

export const dynamic = "force-dynamic";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticle(id).catch(() => null);
  if (!article) notFound();

  return (
    <ArticleDetailClient
      article={article}
      initialAnnotations={[]}
      initialAIAnalysis={[]}
    />
  );
}
