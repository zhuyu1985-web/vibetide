"use server";

import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import {
  searchCollectedItemsForResearch,
  type CollectedItemSearchFilter,
  type CollectedItemWithAnnotations,
} from "@/lib/dal/research/collected-item-search";

// Re-export filter type for client components
export type { CollectedItemSearchFilter };

// Result shape — compatible with search-workbench-client.tsx (Phase 4 will fully redesign)
export type ResearchItemResult = CollectedItemWithAnnotations & {
  // Legacy fields used in search-workbench-client.tsx until Phase 4 rewrite
  districtName: string | null;
  sourceChannel: string;
  platformFallback: string | null;
};

export type ResearchSearchResponse = {
  // Phase 4 will rename `articles` → `items`; keep `articles` key for UI compat in Phase 2
  articles: ResearchItemResult[];
  total: number;
  page: number;
  pageSize: number;
};

// Re-export search types (used by search-workbench-client until Phase 4 rewrite)
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

function mapToResult(item: CollectedItemWithAnnotations): ResearchItemResult {
  return {
    ...item,
    districtName: null, // Phase 4: join annotation table to resolve district name
    sourceChannel: item.outletTier ?? "unknown",
    platformFallback: item.outletName ?? null,
  };
}

export async function searchArticles(
  params: {
    keyword?: string;
    tiers?: string[];
    districtIds?: string[];
    outletId?: string;
    sourceChannels?: string[];
    timeStart?: string;
    timeEnd?: string;
    page?: number;
    pageSize?: number;
  },
): Promise<ResearchSearchResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;

  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);

  const filter: CollectedItemSearchFilter = {};
  if (params.keyword) filter.titleKeyword = params.keyword;
  if (params.tiers?.length === 1) filter.outletTier = params.tiers[0];
  if (params.districtIds?.length) filter.districtIds = params.districtIds;
  if (params.outletId) filter.outletId = params.outletId;
  if (params.timeStart) filter.publishedAtFrom = new Date(params.timeStart);
  if (params.timeEnd) filter.publishedAtTo = new Date(params.timeEnd);

  const result = await searchCollectedItemsForResearch(
    organizationId,
    filter,
    { limit: pageSize, offset: (page - 1) * pageSize },
  );

  return {
    articles: result.items.map(mapToResult),
    total: result.total,
    page,
    pageSize,
  };
}

// Advanced search — maps conditions to filter fields where possible (Phase 4 will redesign)
export async function advancedSearchArticles(
  params: AdvancedSearchParams,
): Promise<ResearchSearchResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;

  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);

  const filter: CollectedItemSearchFilter = {};
  for (const cond of params.conditions) {
    if (cond.operator === "contains" || cond.operator === "equals") {
      switch (cond.field) {
        case "keyword":
          filter.titleKeyword = cond.value;
          break;
        case "title":
          filter.titleKeyword = cond.value;
          break;
        case "content":
          filter.contentKeyword = cond.value;
          break;
        case "tier":
          filter.outletTier = cond.value;
          break;
        case "district":
          filter.districtIds = [cond.value];
          break;
      }
    }
    if (cond.field === "publishedAt" && cond.operator === "between") {
      if (cond.value) filter.publishedAtFrom = new Date(cond.value);
      if (cond.value2) filter.publishedAtTo = new Date(cond.value2);
    }
  }

  const result = await searchCollectedItemsForResearch(
    organizationId,
    filter,
    { limit: pageSize, offset: (page - 1) * pageSize },
  );

  return {
    articles: result.items.map(mapToResult),
    total: result.total,
    page,
    pageSize,
  };
}

// Primary action (new clean API — used by Phase 4 UI)
export async function searchResearchItems(
  filter: CollectedItemSearchFilter,
  page: number,
  pageSize: number,
) {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);
  return await searchCollectedItemsForResearch(
    organizationId,
    filter,
    { limit: pageSize, offset: (page - 1) * pageSize },
  );
}
