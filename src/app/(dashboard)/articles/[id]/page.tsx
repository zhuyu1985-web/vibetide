import { notFound } from "next/navigation";
import { getArticle } from "@/lib/dal/articles";
import { getAnnotations } from "@/lib/dal/annotations";
import { getAIAnalysisCache } from "@/lib/dal/ai-analysis";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import ArticleDetailClient from "./article-detail-client";

export const dynamic = "force-dynamic";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [article, annotations, aiAnalysis, orgId] = await Promise.all([
    getArticle(id).catch(() => null),
    getAnnotations(id).catch(() => []),
    getAIAnalysisCache(id).catch(() => []),
    getCurrentUserOrg().catch(() => null),
  ]);

  if (!article) notFound();

  return (
    <ArticleDetailClient
      article={article}
      organizationId={orgId ?? ""}
      initialAnnotations={annotations}
      initialAIAnalysis={aiAnalysis}
    />
  );
}
