"use server";

import { revalidatePath } from "next/cache";
import { syncCmsCatalogs, type SyncResult } from "@/lib/cms";
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
