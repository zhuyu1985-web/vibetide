import { redirect } from "next/navigation";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listCqDistricts } from "@/lib/dal/research/cq-districts";
import { listMediaOutlets } from "@/lib/dal/research/media-outlets";
import { searchNewsArticles } from "@/lib/dal/research/news-article-search";
import { SearchWorkbenchClient } from "./search-workbench-client";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(ctx.userId, ctx.organizationId, PERMISSIONS.MENU_RESEARCH);
  if (!allowed) redirect("/home");

  const [districts, outlets, initialResult] = await Promise.all([
    listCqDistricts(),
    listMediaOutlets({ organizationId: ctx.organizationId }),
    searchNewsArticles({ page: 1, pageSize: 50 }),
  ]);

  return (
    <SearchWorkbenchClient
      districts={districts}
      outlets={outlets}
      initialResult={initialResult}
    />
  );
}
