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
import { updateAppChannelBinding as dalUpdateAppChannelBinding } from "@/lib/dal/app-channels";

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
 * - 成功且非 dryRun 时 revalidate /settings/cms-mapping
 */
export async function triggerCatalogSyncAction(
  input: TriggerCatalogSyncInput = {},
): Promise<SyncResult> {
  const { userId, organizationId } = await requireUserAndOrg();

  const result = await syncCmsCatalogs(organizationId, {
    triggerSource: "manual",
    operatorId: userId,
    dryRun: input.dryRun,
    deleteMissing: input.deleteMissing,
  });

  if (result.success && !input.dryRun) {
    revalidatePath("/settings/cms-mapping");
  }

  return result;
}

// ---------------------------------------------------------------------------
// 发布稿件到 CMS（UI / Mission 调用入口）
// ---------------------------------------------------------------------------

export interface PublishArticleToCmsActionInput {
  articleId: string;
  appChannelSlug: PublishInput["appChannelSlug"];
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
      appChannelSlug: input.appChannelSlug,
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

// ---------------------------------------------------------------------------
// APP 栏目绑定更新（运营 UI 调用）
// ---------------------------------------------------------------------------

export interface UpdateAppChannelBindingInput {
  slug: string;
  catalogId: string;
  listStyleType?: string;
}

/**
 * 把某个 APP 栏目绑定到指定的 CMS catalog（UUID）。
 *
 * - 仅登录用户可调用；组织边界由 requireUserAndOrg 决定
 * - listStyleType 目前固定为 "0"（默认），Phase 2 再开放多样式选择
 * - 成功后 revalidate /settings/cms-mapping
 */
export async function updateAppChannelBindingAction(
  input: UpdateAppChannelBindingInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { organizationId } = await requireUserAndOrg();
    await dalUpdateAppChannelBinding(organizationId, input.slug, {
      defaultCatalogId: input.catalogId,
      defaultListStyle: {
        listStyleType: input.listStyleType ?? "0",
        listStyleName: "默认",
        imageUrlList: [],
      },
    });
    revalidatePath("/settings/cms-mapping");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
