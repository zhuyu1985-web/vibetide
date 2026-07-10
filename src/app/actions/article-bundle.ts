"use server";

import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { articles, externalPublications } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { getArticle } from "@/lib/dal/articles";
import { getAnnotations } from "@/lib/dal/annotations";
import { getAIAnalysisCache } from "@/lib/dal/ai-analysis";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import type {
  ArticleDetailClientProps,
  ExternalPublicationView,
} from "@/app/(dashboard)/articles/[id]/types";

/** ArticleDetailClient 渲染所需的 6 路数据（用于在 cowork 右侧 Sheet 嵌入编辑器）。 */
export type ArticleDetailBundle = Pick<
  ArticleDetailClientProps,
  | "article"
  | "organizationId"
  | "initialAnnotations"
  | "initialAIAnalysis"
  | "articleLanguage"
  | "externalPublications"
>;

/**
 * 取文章详情完整数据包 —— 复刻 articles/[id]/page.tsx 的 6 路 Promise.all
 * （含每路 .catch 兜底，避免附属查询抖动让整个 Sheet 加载失败）。
 * org 隔离由 getArticle 内部 getCurrentUserOrg + eq(organizationId) 保证：
 * 越权 / 不存在 → article 为 null → 返回 null。
 */
export async function getArticleDetailBundle(
  articleId: string,
): Promise<ArticleDetailBundle | null> {
  await requireAuth();

  const [article, annotations, aiAnalysis, orgId, articleRow, pubRows] =
    await Promise.all([
      getArticle(articleId).catch(() => null),
      getAnnotations(articleId).catch(() => []),
      getAIAnalysisCache(articleId).catch(() => []),
      getCurrentUserOrg().catch(() => null),
      db.query.articles
        .findFirst({
          where: eq(articles.id, articleId),
          columns: { language: true },
        })
        .catch(() => null),
      db
        .select({
          platform: externalPublications.platform,
          status: externalPublications.status,
          platformPostUrl: externalPublications.platformPostUrl,
        })
        .from(externalPublications)
        .where(eq(externalPublications.articleId, articleId))
        .orderBy(desc(externalPublications.submittedAt))
        .catch((): ExternalPublicationView[] => []),
    ]);

  if (!article) return null;

  return {
    article,
    organizationId: orgId ?? "",
    initialAnnotations: annotations,
    initialAIAnalysis: aiAnalysis,
    articleLanguage: articleRow?.language ?? "zh",
    externalPublications: (pubRows ?? []).map((r) => ({
      platform: r.platform,
      status: r.status,
      platformPostUrl: r.platformPostUrl,
    })),
  };
}
