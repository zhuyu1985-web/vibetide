import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listCqDistricts } from "@/lib/dal/research/cq-districts";
import { searchCollectedItemsForResearch } from "@/lib/dal/research/collected-item-search";
import { SearchWorkbenchClient } from "./search-workbench-client";

// NOTE: listMediaOutlets removed in A1 Phase 0 — outlets prop stubbed to []
// A4 阶段研究工作台 UI 重做时重新接入 Collection Hub 数据

export default async function ResearchPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(ctx.userId, ctx.organizationId, PERMISSIONS.MENU_RESEARCH);
  if (!allowed) redirect("/home");

  const [districts, rawResult] = await Promise.all([
    listCqDistricts(),
    searchCollectedItemsForResearch(ctx.organizationId, {}, { limit: 50, offset: 0 }),
  ]);

  // Map DAL result to the shape SearchWorkbenchClient expects (Phase 4 will fully redesign)
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

  return (
    <SearchWorkbenchClient
      districts={districts}
      outlets={[]}
      initialResult={initialResult}
    />
  );
}
