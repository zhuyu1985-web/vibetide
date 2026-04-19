import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listAppChannels } from "@/lib/dal/app-channels";
import { listCmsCatalogsForBindingDropdown } from "@/lib/dal/cms-catalogs";
import { listRecentSyncLogs } from "@/lib/dal/cms-sync-logs";
import { CmsMappingClient } from "./cms-mapping-client";

export const dynamic = "force-dynamic";

/**
 * CMS 栏目映射配置页（Phase 1 最小 UI）
 *
 * 三件事：
 * 1. 列出当前组织的 9 个 APP 栏目 + 绑定状态
 * 2. 下拉选择 CMS catalog 绑定 / 解绑
 * 3. 触发"立即同步"拉取最新 CMS 栏目树
 *
 * 不做的事（留给 Phase 2+）：样式抛光、栏目树可视化、日志分页。
 */
export default async function CmsMappingPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [appChannels, cmsCatalogs, recentLogs] = await Promise.all([
    listAppChannels(orgId).catch(() => []),
    listCmsCatalogsForBindingDropdown(orgId).catch(() => []),
    listRecentSyncLogs(orgId, { limit: 5 }).catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <CmsMappingClient
        appChannels={appChannels.map((c) => ({
          id: c.id,
          slug: c.slug,
          displayName: c.displayName,
          reviewTier: c.reviewTier,
          icon: c.icon,
          sortOrder: c.sortOrder ?? 0,
          isEnabled: c.isEnabled ?? true,
          defaultCatalogId: c.defaultCatalogId,
          defaultCatalogName: c.defaultCatalog?.name ?? null,
          defaultCoverUrl: c.defaultCoverUrl,
        }))}
        cmsCatalogs={cmsCatalogs}
        recentLogs={recentLogs.map((log) => ({
          id: log.id,
          state: log.state,
          triggerSource: log.triggerSource ?? "",
          stats: log.stats as Record<string, number> | null,
          startedAt: log.startedAt.toISOString(),
          completedAt: log.completedAt?.toISOString() ?? null,
          durationMs: log.durationMs ?? null,
          errorMessage: log.errorMessage ?? null,
        }))}
      />
    </div>
  );
}
