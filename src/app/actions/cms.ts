"use server";

import { revalidatePath } from "next/cache";
import {
  publishArticleToCms,
  syncCmsCatalogs,
  type PublishInput,
  type PublishResult,
  type SyncResult,
} from "@/lib/cms";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";

// ---------------------------------------------------------------------------
// Auth helpers (multi-tenant boundary)
//
// 项目约定：每个 server action 文件内联 requireAuth —— 与 benchmarking.ts、
// knowledge-bases.ts 保持一致。组织信息从 user_profiles 查询（通过共享的
// getCurrentUserAndOrg helper）。
// ---------------------------------------------------------------------------

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function requireUserAndOrg(): Promise<{ userId: string; organizationId: string }> {
  await requireAuth();
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) throw new Error("无法获取组织信息");
  return ctx;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface TriggerCatalogSyncInput {
  dryRun?: boolean;
  deleteMissing?: boolean;
}

/**
 * 手动触发 CMS 栏目同步（供运营 UI / 其他 server action 调用）。
 *
 * - 仅登录用户可调用，组织边界由 user_profiles 决定
 * - 成功与失败都 revalidate /settings/cms-mapping，让新增的日志行立刻显示
 * - 任何抛出（权限 / 配置 / 网络）都被收敛成 SyncResult，UI 能统一展示
 */
export async function triggerCatalogSyncAction(
  input: TriggerCatalogSyncInput = {},
): Promise<SyncResult> {
  try {
    const { userId, organizationId } = await requireUserAndOrg();
    const result = await syncCmsCatalogs(organizationId, {
      triggerSource: "manual",
      operatorId: userId,
      dryRun: input.dryRun,
      deleteMissing: input.deleteMissing,
    });
    if (!input.dryRun) {
      revalidatePath("/settings/cms-mapping");
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!input.dryRun) {
      revalidatePath("/settings/cms-mapping");
    }
    return {
      success: false,
      syncLogId: "",
      stats: {
        channelsFetched: 0, channelsUpserted: 0,
        appsFetched: 0, appsUpserted: 0,
        catalogsFetched: 0, catalogsInserted: 0,
        catalogsUpdated: 0, catalogsSoftDeleted: 0,
        unchangedCount: 0,
        inserted: 0, updated: 0, softDeleted: 0, unchanged: 0,
      },
      warnings: [],
      error: { code: "unknown", message, stage: "unknown" },
    };
  }
}

// ---------------------------------------------------------------------------
// 发布稿件到 CMS（UI / Mission 调用入口）
// ---------------------------------------------------------------------------

export interface PublishArticleToCmsActionInput {
  articleId: string;
  triggerSource?: PublishInput["triggerSource"];
  allowUpdate?: boolean;
}

/**
 * 将稿件推送至 CMS 的 server action 包装。
 *
 * - 仅登录用户可调用；operatorId 取自当前会话（组织边界由下游 publishArticleToCms 校验）
 * - triggerSource 默认为 "manual"
 * - 发布完成后 revalidate 稿件详情页与任务中心列表
 * - 业务异常（CmsError / 映射失败等）会被捕获并以 `{ error }` 返回，便于 UI 层展示
 */
export async function publishArticleToCmsAction(
  input: PublishArticleToCmsActionInput,
): Promise<PublishResult | { error: string }> {
  const { userId } = await requireUserAndOrg();

  try {
    const result = await publishArticleToCms({
      articleId: input.articleId,
      operatorId: userId,
      triggerSource: input.triggerSource ?? "manual",
      allowUpdate: input.allowUpdate,
    });

    revalidatePath(`/articles/${input.articleId}`);
    revalidatePath(`/missions`);

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}
