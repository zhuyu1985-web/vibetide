"use server";

import { db } from "@/db";
import { myAccounts, benchmarkAccounts } from "@/db/schema";
import { userProfiles } from "@/db/schema/users";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireUserAndOrg() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("未登录");

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("用户未关联组织");
  return { userId: user.id, orgId: profile.organizationId };
}

type Platform =
  | "app"
  | "website"
  | "wechat"
  | "weibo"
  | "douyin"
  | "kuaishou"
  | "bilibili"
  | "xiaohongshu"
  | "tv"
  | "radio"
  | "other";

type BenchmarkLevel = "central" | "provincial" | "city" | "industry" | "self_media";

function revalidateAccountPaths() {
  revalidatePath("/topic-compare/accounts");
  revalidatePath("/benchmark-accounts");
  revalidatePath("/topic-compare");
}

// ---------------------------------------------------------------------------
// my_accounts CRUD
// ---------------------------------------------------------------------------

export async function createMyAccount(input: {
  platform: Platform;
  handle: string;
  name: string;
  accountUrl?: string;
  description?: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { orgId } = await requireUserAndOrg();
    if (!input.handle?.trim() || !input.name?.trim()) {
      return { success: false, error: "handle 和 name 不能为空" };
    }

    const [row] = await db
      .insert(myAccounts)
      .values({
        organizationId: orgId,
        platform: input.platform,
        handle: input.handle.trim(),
        name: input.name.trim(),
        accountUrl: input.accountUrl?.trim() || null,
        description: input.description?.trim() || null,
        avatarUrl: input.avatarUrl?.trim() || null,
      })
      .onConflictDoNothing({
        target: [myAccounts.organizationId, myAccounts.platform, myAccounts.handle],
      })
      .returning({ id: myAccounts.id });

    if (!row) return { success: false, error: "账号已存在（同 platform + handle）" };
    revalidateAccountPaths();
    return { success: true, id: row.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateMyAccount(input: {
  id: string;
  name?: string;
  accountUrl?: string;
  description?: string;
  avatarUrl?: string;
  isEnabled?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { orgId } = await requireUserAndOrg();
    await db
      .update(myAccounts)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.accountUrl !== undefined ? { accountUrl: input.accountUrl?.trim() || null } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl?.trim() || null } : {}),
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(myAccounts.id, input.id), eq(myAccounts.organizationId, orgId)));

    revalidateAccountPaths();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteMyAccount(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { orgId } = await requireUserAndOrg();
    await db
      .delete(myAccounts)
      .where(and(eq(myAccounts.id, id), eq(myAccounts.organizationId, orgId)));
    revalidateAccountPaths();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// benchmark_accounts CRUD（预置账号不允许删/编辑核心字段）
// ---------------------------------------------------------------------------

export async function createBenchmarkAccount(input: {
  platform: Platform;
  level: BenchmarkLevel;
  handle: string;
  name: string;
  accountUrl?: string;
  description?: string;
  region?: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { orgId } = await requireUserAndOrg();
    if (!input.handle?.trim() || !input.name?.trim()) {
      return { success: false, error: "handle 和 name 不能为空" };
    }

    const [row] = await db
      .insert(benchmarkAccounts)
      .values({
        organizationId: orgId,
        platform: input.platform,
        level: input.level,
        handle: input.handle.trim(),
        name: input.name.trim(),
        accountUrl: input.accountUrl?.trim() || null,
        description: input.description?.trim() || null,
        region: input.region?.trim() || null,
        avatarUrl: input.avatarUrl?.trim() || null,
        isPreset: false,
      })
      .onConflictDoNothing({
        target: [benchmarkAccounts.platform, benchmarkAccounts.handle, benchmarkAccounts.organizationId],
      })
      .returning({ id: benchmarkAccounts.id });

    if (!row) return { success: false, error: "账号已存在" };
    revalidateAccountPaths();
    return { success: true, id: row.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function updateBenchmarkAccount(input: {
  id: string;
  name?: string;
  accountUrl?: string;
  description?: string;
  region?: string;
  avatarUrl?: string;
  isEnabled?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireUserAndOrg();
    const target = await db.query.benchmarkAccounts.findFirst({
      where: eq(benchmarkAccounts.id, input.id),
    });
    if (!target) return { success: false, error: "账号不存在" };

    // Preset 账号只允许改 isEnabled（禁用/启用）
    if (target.isPreset) {
      await db
        .update(benchmarkAccounts)
        .set({
          ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
          updatedAt: new Date(),
        })
        .where(eq(benchmarkAccounts.id, input.id));
      revalidateAccountPaths();
      return { success: true };
    }

    await db
      .update(benchmarkAccounts)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.accountUrl !== undefined ? { accountUrl: input.accountUrl?.trim() || null } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.region !== undefined ? { region: input.region?.trim() || null } : {}),
        ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl?.trim() || null } : {}),
        ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
        updatedAt: new Date(),
      })
      .where(eq(benchmarkAccounts.id, input.id));

    revalidateAccountPaths();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function deleteBenchmarkAccount(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { orgId } = await requireUserAndOrg();
    const target = await db.query.benchmarkAccounts.findFirst({
      where: eq(benchmarkAccounts.id, id),
    });
    if (!target) return { success: false, error: "账号不存在" };
    if (target.isPreset) {
      return { success: false, error: "预置账号不可删除，可停用" };
    }
    if (target.organizationId !== orgId) {
      return { success: false, error: "无权删除" };
    }
    await db.delete(benchmarkAccounts).where(eq(benchmarkAccounts.id, id));
    revalidateAccountPaths();
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
