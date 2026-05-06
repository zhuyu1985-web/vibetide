import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listCqDistricts } from "@/lib/dal/research/cq-districts";
import { searchCollectedItemsForResearch } from "@/lib/dal/research/collected-item-search";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { SearchWorkbenchClient } from "./search-workbench-client";

// A3 已接通 collected_items 数据源（outlets + districts + collected_items 全部从 Collection Hub 读取）

export default async function ResearchPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(ctx.userId, ctx.organizationId, PERMISSIONS.MENU_RESEARCH);
  if (!allowed) redirect("/home");

  const [districts, outlets, rawResult] = await Promise.all([
    listCqDistricts(),
    listOutletsByOrg(ctx.organizationId),
    searchCollectedItemsForResearch(ctx.organizationId, {}, { limit: 50, offset: 0 }),
  ]);

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

  return (
    <SearchWorkbenchClient
      districts={districts}
      outlets={outlets.map((o) => ({ id: o.id, name: o.outletName }))}
      initialResult={initialResult}
    />
  );
}
