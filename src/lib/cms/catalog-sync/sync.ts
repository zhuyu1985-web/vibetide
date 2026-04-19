import { CmsClient } from "../client";
import { getChannels, getAppList, getCatalogTree } from "../api-endpoints";
import { requireCmsConfig, isCatalogSyncEnabled } from "../feature-flags";
import { CmsConfigError, classifyCmsError } from "../errors";
import { upsertCmsChannel } from "@/lib/dal/cms-channels";
import { upsertCmsApp } from "@/lib/dal/cms-apps";
import {
  insertCmsCatalog,
  updateCmsCatalog,
  softDeleteCmsCatalog,
  listAllActiveCmsCatalogs,
} from "@/lib/dal/cms-catalogs";
import {
  startCmsSyncLog,
  completeCmsSyncLog,
  failCmsSyncLog,
} from "@/lib/dal/cms-sync-logs";
import { flattenTree, type FlatCatalogRow } from "./flatten-tree";
import { reconcileCatalogs } from "./reconcile";

export interface SyncCmsCatalogsOptions {
  triggerSource: "manual" | "scheduled" | "auto_repair" | "first_time_setup";
  operatorId?: string;
  /** 仅查询变更，不写库 */
  dryRun?: boolean;
  /** 默认 true：本地有但 CMS 没有 → 软删 */
  deleteMissing?: boolean;
}

export interface SyncResult {
  success: boolean;
  syncLogId: string;
  stats: {
    channelsFetched: number;
    channelsUpserted: number;
    appsFetched: number;
    appsUpserted: number;
    catalogsFetched: number;
    catalogsInserted: number;
    catalogsUpdated: number;
    catalogsSoftDeleted: number;
    unchangedCount: number;
    /** Short-form aliases aligned with reconcile.stats (for sync log consumers). */
    inserted: number;
    updated: number;
    softDeleted: number;
    unchanged: number;
  };
  warnings: string[];
  error?: { code: string; message: string; stage: string };
}

/**
 * CMS 栏目三步同步主流程。
 *
 * 设计文档 §9.4 / §11.5；Skill spec `cms_catalog_sync.md`
 */
export async function syncCmsCatalogs(
  organizationId: string,
  options: SyncCmsCatalogsOptions,
): Promise<SyncResult> {
  if (!isCatalogSyncEnabled()) {
    return {
      success: false,
      syncLogId: "",
      stats: emptyStats(),
      warnings: ["catalog sync disabled by feature flag"],
      error: { code: "disabled", message: "VIBETIDE_CATALOG_SYNC_ENABLED=false", stage: "config" },
    };
  }

  const config = requireCmsConfig();
  const client = new CmsClient({
    host: config.host,
    loginCmcId: config.loginCmcId,
    loginCmcTid: config.loginCmcTid,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  });

  const syncLogId = await startCmsSyncLog(organizationId, {
    triggerSource: options.triggerSource,
    operatorId: options.operatorId,
  });

  const warnings: string[] = [];
  const stats = emptyStats();
  const dryRun = options.dryRun ?? false;
  const deleteMissing = options.deleteMissing ?? true;

  try {
    // -----------------------
    // Step 1: getChannels
    // -----------------------
    const channelsRes = await getChannels(client, { appAndWeb: 1 });
    stats.channelsFetched = Object.keys(channelsRes.data ?? {}).length;

    const appChannel = channelsRes.data?.CHANNEL_APP;
    if (!appChannel) {
      throw new CmsConfigError("CMS 未返回 CHANNEL_APP，请检查账号权限");
    }

    if (!dryRun) {
      await upsertCmsChannel(organizationId, {
        channelKey: "CHANNEL_APP",
        channelCode: appChannel.code,
        name: appChannel.name,
        pickValue: appChannel.pickValue,
        thirdFlag: appChannel.thirdFlag,
      });
      stats.channelsUpserted = 1;
    }

    // -----------------------
    // Step 2: getAppList(type=1)
    // -----------------------
    const appsRes = await getAppList(client, "1");
    const apps = appsRes.data ?? [];
    stats.appsFetched = apps.length;

    if (apps.length === 0) {
      warnings.push("CMS 未返回任何 type=1 APP 应用；保留本地数据不动");
    }

    if (!dryRun) {
      for (const app of apps) {
        await upsertCmsApp(organizationId, {
          cmsAppId: String(app.id),
          channelKey: "CHANNEL_APP",
          siteId: app.siteid,
          name: app.name,
          appkey: app.appkey ?? undefined,
          appsecret: app.appsecret ?? undefined,
        });
      }
      stats.appsUpserted = apps.length;
    }

    // -----------------------
    // Step 3: getCatalogTree × N apps
    // -----------------------
    const allFlat: FlatCatalogRow[] = [];
    for (const app of apps) {
      const treeRes = await getCatalogTree(client, {
        appId: String(app.id),
        types: "1",             // 仅新闻栏目
        isPrivilege: "false",
      });
      const rows = flattenTree(treeRes.data ?? [], app.id, app.siteid);
      allFlat.push(...rows);
    }
    stats.catalogsFetched = allFlat.length;

    if (allFlat.length === 0 && apps.length > 0) {
      warnings.push("CMS 所有应用下均返回 0 栏目；保留本地数据不动（保护性措施）");
    }

    // -----------------------
    // Step 4: 差量对比 + 应用
    // -----------------------
    const existing = await listAllActiveCmsCatalogs(organizationId);
    const plan = reconcileCatalogs({
      fetched: allFlat,
      existing,
      deleteMissing,
    });

    if (!dryRun) {
      for (const row of plan.inserts) {
        await insertCmsCatalog(organizationId, row);
      }
      for (const u of plan.updates) {
        await updateCmsCatalog(organizationId, u.cmsCatalogId, u.patch);
      }
      for (const d of plan.softDeletes) {
        await softDeleteCmsCatalog(organizationId, d.cmsCatalogId);
      }
    }
    stats.catalogsInserted = plan.inserts.length;
    stats.catalogsUpdated = plan.updates.length;
    stats.catalogsSoftDeleted = plan.softDeletes.length;
    stats.unchangedCount = plan.unchanged;
    // Short-form aliases (consumed by tests, UI widgets, sync-log viewers).
    stats.inserted = plan.inserts.length;
    stats.updated = plan.updates.length;
    stats.softDeleted = plan.softDeletes.length;
    stats.unchanged = plan.unchanged;

    // -----------------------
    // 完成
    // -----------------------
    if (!dryRun) {
      await completeCmsSyncLog(syncLogId, { stats, warnings });
    }
    return { success: true, syncLogId, stats, warnings };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stage = classifyCmsError(err);
    await failCmsSyncLog(syncLogId, message);
    return {
      success: false,
      syncLogId,
      stats,
      warnings,
      error: { code: stage, message, stage },
    };
  }
}

function emptyStats(): SyncResult["stats"] {
  return {
    channelsFetched: 0, channelsUpserted: 0,
    appsFetched: 0, appsUpserted: 0,
    catalogsFetched: 0, catalogsInserted: 0,
    catalogsUpdated: 0, catalogsSoftDeleted: 0,
    unchangedCount: 0,
    inserted: 0, updated: 0, softDeleted: 0, unchanged: 0,
  };
}
