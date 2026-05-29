import { redirect } from "next/navigation";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { listCmsCatalogsForBindingDropdown } from "@/lib/dal/cms-catalogs";
import { listRecentSyncLogs } from "@/lib/dal/cms-sync-logs";
import { requireCmsConfig } from "@/lib/cms/feature-flags";
import { CmsMappingClient } from "./cms-mapping-client";

/**
 * CMS 栏目映射配置页。
 *
 * 默认推送目标从 env `CMS_DEFAULT_SITE_ID` / `CMS_DEFAULT_APP_ID` /
 * `CMS_DEFAULT_CATALOG_ID` 读取（缺失时代码内 fallback 81/1768/10210）；
 * workflow_template 在 cms_publish 步骤参数里可覆盖到指定栏目。本页面仅用于：
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

  // requireCmsConfig 缺 env 时会抛；用 try 兜底让 UI 不挂
  let defaultTarget = { siteId: 81, appId: 1768, catalogId: 10210 };
  try {
    const cfg = requireCmsConfig();
    defaultTarget = {
      siteId: cfg.defaultSiteId,
      appId: cfg.defaultAppId,
      catalogId: cfg.defaultCatalogId,
    };
  } catch (error) {
    console.warn("[cms-mapping] requireCmsConfig failed, falling back to hardcoded default", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

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
        defaultTarget={defaultTarget}
      />
    </div>
  );
}
