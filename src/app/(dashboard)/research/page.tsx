import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listCqDistricts } from "@/lib/dal/research/cq-districts";
import { searchCollectedItemsForResearch } from "@/lib/dal/research/collected-item-search";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { listResearchTopics } from "@/lib/dal/research/research-topics";
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_VALUES,
  OUTLET_TIER_LABELS,
  OUTLET_TIER_VALUES,
} from "@/lib/collection/constants";
import { SearchWorkbenchClient } from "./search-workbench-client";
import type { BuilderOptions } from "./advanced-search-builder";

// A3 已接通 collected_items 数据源（outlets + districts + collected_items 全部从 Collection Hub 读取）
// A4 Phase 3：加载 BuilderOptions（高级检索 UI 字段下拉选项）

export default async function ResearchPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    PERMISSIONS.MENU_RESEARCH,
  );
  if (!allowed) redirect("/home");

  const orgId = ctx.organizationId;

  const regionsPromise = db
    .selectDistinct({ region: collectedItems.outletRegion })
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, orgId),
        sql`${collectedItems.outletRegion} IS NOT NULL`,
      ),
    )
    .then((rows) =>
      rows
        .map((r) => r.region)
        .filter((r): r is string => Boolean(r)),
    );

  const platformsPromise = db
    .selectDistinct({ ch: collectedItems.firstSeenChannel })
    .from(collectedItems)
    .where(eq(collectedItems.organizationId, orgId))
    .then((rows) =>
      rows
        .map((r) => r.ch)
        .filter((p): p is string => Boolean(p)),
    );

  const [districts, outlets, topicSummaries, rawResult, regions, platforms] =
    await Promise.all([
      listCqDistricts(),
      listOutletsByOrg(orgId),
      listResearchTopics(orgId),
      searchCollectedItemsForResearch(orgId, {}, { limit: 50, offset: 0 }),
      regionsPromise,
      platformsPromise,
    ]);

  const topics = topicSummaries.map((t) => ({ id: t.id, name: t.name }));

  // Map DAL result to the shape SearchWorkbenchClient expects
  const initialResult = {
    articles: rawResult.items.map((item) => ({
      ...item,
      districtName: null as string | null,
      sourceChannel: item.outletTier ?? "unknown",
      platformFallback: item.outletName ?? null,
    })),
    total: rawResult.total,
    page: 1,
    pageSize: 50,
  };

  const builderOptions: BuilderOptions = {
    outletTiers: OUTLET_TIER_VALUES.map((t) => ({
      value: t,
      label: OUTLET_TIER_LABELS[t],
    })),
    outletRegions: regions,
    districts: districts.map((d) => ({ id: d.id, name: d.name })),
    topics,
    contentTypes: CONTENT_TYPE_VALUES.map((t) => ({
      value: t,
      label: CONTENT_TYPE_LABELS[t],
    })),
    platforms,
  };

  return (
    <SearchWorkbenchClient
      districts={districts}
      outlets={outlets.map((o) => ({ id: o.id, name: o.outletName }))}
      initialResult={initialResult}
      builderOptions={builderOptions}
    />
  );
}
