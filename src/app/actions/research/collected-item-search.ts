"use server";

import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import {
  advancedSearchCollectedItems,
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

// Re-export search types from shared module (A4 Phase 1: 11 fields + valueRange)
export type {
  AdvancedSearchField,
  AdvancedSearchOperator,
  AdvancedSearchCondition,
  AdvancedSearchCondition as SearchCondition, // 兼容旧名
  SidebarFilter,
} from "@/app/(dashboard)/research/search-mode-types";

import type {
  AdvancedSearchCondition as _AdvancedSearchCondition,
  SidebarFilter as _SidebarFilter,
} from "@/app/(dashboard)/research/search-mode-types";

export type AdvancedSearchParams = {
  conditions: _AdvancedSearchCondition[];
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
        case "title":
          filter.titleKeyword = cond.value;
          break;
        case "content":
          filter.contentKeyword = cond.value;
          break;
        case "outletTier": // was "tier"
          filter.outletTier = cond.value;
          break;
        case "district":
          filter.districtIds = [cond.value];
          break;
        case "platform": // was "channel" — filter has no platform field, skip until Phase 3 searchAdvanced
          break;
        // outletName / outletRegion / topic / contentType / author —
        // 旧 advancedSearchArticles 不支持，留待 Phase 3 切到 searchAdvanced 后弃用
      }
    }
    if (cond.field === "publishedAt" && cond.operator === "between") {
      if (cond.valueRange) {
        filter.publishedAtFrom = new Date(cond.valueRange.from);
        filter.publishedAtTo = new Date(cond.valueRange.to);
      }
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

// A4 Phase 3：searchAdvanced — 直接透传 sidebarFilter 给 DAL
// DAL 内 buildSidebarExprs 各组独立 OR-bracket → 跨组 AND → 与用户 conditions AND
// 用户手写 conditions ≤ 10 校验；sidebar 各组 OR-bracket 不计入 10 限
export async function searchAdvanced(payload: {
  conditions: _AdvancedSearchCondition[];
  sidebarFilter: _SidebarFilter;
  page?: number;
  pageSize?: number;
}) {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);

  if (payload.conditions.length > 10) {
    throw new Error("手动条件超过 10，请减少行数");
  }

  const page = payload.page ?? 1;
  const pageSize = payload.pageSize ?? 50;
  const result = await advancedSearchCollectedItems(
    organizationId,
    payload.conditions,
    { limit: pageSize, offset: (page - 1) * pageSize },
    payload.sidebarFilter,
  );
  return { items: result.items, total: result.total, page, pageSize };
}
