"use server";

import {
  searchNewsArticles,
  advancedSearchNewsArticles,
  type ArticleSearchParams,
  type ArticleSearchResponse,
  type AdvancedSearchParams,
} from "@/lib/dal/research/news-article-search";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";

export async function searchArticles(
  params: ArticleSearchParams,
): Promise<ArticleSearchResponse> {
  await requirePermission(PERMISSIONS.MENU_RESEARCH);
  return searchNewsArticles(params);
}

export async function advancedSearchArticles(
  params: AdvancedSearchParams,
): Promise<ArticleSearchResponse> {
  await requirePermission(PERMISSIONS.MENU_RESEARCH);
  return advancedSearchNewsArticles(params);
}
