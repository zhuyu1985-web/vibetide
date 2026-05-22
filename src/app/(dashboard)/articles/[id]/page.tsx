import { notFound } from "next/navigation";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { articles, externalPublications } from "@/db/schema";
import { getArticle } from "@/lib/dal/articles";
import { getAnnotations } from "@/lib/dal/annotations";
import { getAIAnalysisCache } from "@/lib/dal/ai-analysis";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import ArticleDetailClient from "./article-detail-client";
import type { ExternalPublicationView } from "./types";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [article, annotations, aiAnalysis, orgId, articleRow, pubRows] =
    await Promise.all([
      getArticle(id).catch(() => null),
      getAnnotations(id).catch(() => []),
      getAIAnalysisCache(id).catch(() => []),
      getCurrentUserOrg().catch(() => null),
      // 直接查 articles.language —— UI 类型 ArticleDetail 尚未包含该列
      db.query.articles
        .findFirst({
          where: eq(articles.id, id),
          columns: { language: true },
        })
        .catch(() => null),
      // 外站发布流水（含状态 + native URL）—— 仅 en 文章会渲染面板，
      // 但 zh 文章拿到空数组也没副作用
      db
        .select({
          platform: externalPublications.platform,
          status: externalPublications.status,
          platformPostUrl: externalPublications.platformPostUrl,
        })
        .from(externalPublications)
        .where(eq(externalPublications.articleId, id))
        .orderBy(desc(externalPublications.submittedAt))
        .catch((): ExternalPublicationView[] => []),
    ]);

  if (!article) notFound();

  const articleLanguage = articleRow?.language ?? "zh";
  const publications: ExternalPublicationView[] = (pubRows ?? []).map((r) => ({
    platform: r.platform,
    status: r.status,
    platformPostUrl: r.platformPostUrl,
  }));

  return (
    <ArticleDetailClient
      article={article}
      organizationId={orgId ?? ""}
      initialAnnotations={annotations}
      initialAIAnalysis={aiAnalysis}
      articleLanguage={articleLanguage}
      externalPublications={publications}
    />
  );
}
