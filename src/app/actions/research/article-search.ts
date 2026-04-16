"use server";

import {
  searchNewsArticles,
  type ArticleSearchParams,
  type ArticleSearchResponse,
} from "@/lib/dal/research/news-article-search";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";

export async function searchArticles(
  params: ArticleSearchParams,
): Promise<ArticleSearchResponse> {
  await requirePermission(PERMISSIONS.MENU_RESEARCH);
  return searchNewsArticles(params);
}
