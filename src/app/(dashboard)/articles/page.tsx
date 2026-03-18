import { getArticles, getArticleStats } from "@/lib/dal/articles";
import { getCategories } from "@/lib/dal/categories";
import ArticlesClient from "./articles-client";

export default async function ArticlesPage() {
  const [articles, stats, categories] = await Promise.all([
    getArticles().catch(() => []),
    getArticleStats().catch(() => ({ totalCount: 0, draftCount: 0, reviewingCount: 0, approvedCount: 0, publishedCount: 0, todayCount: 0 })),
    getCategories().catch(() => []),
  ]);

  return <ArticlesClient articles={articles} stats={stats} categories={categories} />;
}
