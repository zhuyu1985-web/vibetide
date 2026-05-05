import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listCqDistricts } from "@/lib/dal/research/cq-districts";
import { searchNewsArticles } from "@/lib/dal/research/news-article-search";
import { SearchWorkbenchClient } from "./search-workbench-client";

// NOTE: listMediaOutlets removed in A1 Phase 0 — outlets prop stubbed to []
// A4 阶段研究工作台 UI 重做时重新接入 Collection Hub 数据

export default async function ResearchPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(ctx.userId, ctx.organizationId, PERMISSIONS.MENU_RESEARCH);
  if (!allowed) redirect("/home");

  const [districts, initialResult] = await Promise.all([
    listCqDistricts(),
    searchNewsArticles({ page: 1, pageSize: 50 }),
  ]);

  return (
    <SearchWorkbenchClient
      districts={districts}
      outlets={[]}
      initialResult={initialResult}
    />
  );
}
