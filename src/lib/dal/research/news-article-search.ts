// A3 Phase 1 stub — research_news_articles table has been dropped.
// This file will be replaced by collected-item-search.ts in Phase 2.
// All function bodies throw to prevent silent bad data.

export type ArticleSearchParams = {
  keyword?: string;
  tiers?: string[];
  districtIds?: string[];
  outletId?: string;
  sourceChannels?: string[];
  timeStart?: string;
  timeEnd?: string;
  page?: number;
  pageSize?: number;
};

export type ArticleSearchResult = {
  id: string;
  url: string;
  title: string;
  publishedAt: Date | null;
  outletName: string | null;
  outletTier: string | null;
  districtName: string | null;
  sourceChannel: string;
  crawledAt: Date;
  platformFallback: string | null;
};

export type ArticleSearchResponse = {
  articles: ArticleSearchResult[];
  total: number;
  page: number;
  pageSize: number;
};

export type AdvancedSearchField =
  | "title" | "content" | "keyword" | "outletName"
  | "tier" | "district" | "channel" | "publishedAt";

export type AdvancedSearchOperator =
  | "contains" | "not_contains" | "equals" | "not_equals" | "between";

export type SearchCondition = {
  field: AdvancedSearchField;
  operator: AdvancedSearchOperator;
  value: string;
  value2?: string;
  logic: "and" | "or";
};

export type AdvancedSearchParams = {
  conditions: SearchCondition[];
  page?: number;
  pageSize?: number;
};

// A3 Phase 1 stub — real impl in Phase 2 (collected-item-search.ts)
export async function searchNewsArticles(
  _params: ArticleSearchParams,
): Promise<ArticleSearchResponse> {
  console.warn("[a3-stub] searchNewsArticles: research_news_articles dropped, impl in Phase 2");
  return { articles: [], total: 0, page: 1, pageSize: 50 };
}

// A3 Phase 1 stub — real impl in Phase 2 (collected-item-search.ts)
export async function advancedSearchNewsArticles(
  _params: AdvancedSearchParams,
): Promise<ArticleSearchResponse> {
  console.warn("[a3-stub] advancedSearchNewsArticles: research_news_articles dropped, impl in Phase 2");
  return { articles: [], total: 0, page: 1, pageSize: 50 };
}
