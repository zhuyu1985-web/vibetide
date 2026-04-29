import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listCmsCatalogsForBindingDropdown } from "@/lib/dal/cms-catalogs";
import { listRecentSyncLogs } from "@/lib/dal/cms-sync-logs";
import { CmsMappingClient } from "./cms-mapping-client";

/**
 * CMS 栏目映射配置页（Phase 1 简化版）。
 *
 * 当前阶段：CMS 推送目标硬编码在 article-mapper
 * （siteId=81 / appId=1768 / catalogId=10210），本页面仅用于：
 *   - 查看已同步到本地的 CMS 栏目树（只读）
 *   - 查看最近的同步日志
 *   - 手动触发"立即同步"
 */
export default async function CmsMappingPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const [cmsCatalogs, recentLogs] = await Promise.all([
    listCmsCatalogsForBindingDropdown(orgId).catch(() => []),
    listRecentSyncLogs(orgId, { limit: 5 }).catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <CmsMappingClient
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
