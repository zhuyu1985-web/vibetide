"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";
import { db } from "@/db";
import { scheduledJobs } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { getCurrentUser } from "@/lib/auth";

const REVALIDATE_PATH = "/settings/scheduled-jobs";

async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: "未登录" };
  if (!user.isSuperAdmin) return { ok: false as const, error: "需要 super admin 权限" };
  return { ok: true as const, user };
}

/**
 * 更新一个 job 的 cron 表达式 + timezone(同步重算 next_run_at)。
 */
export async function updateScheduledJobCron(input: {
  id: string;
  cronExpression: string;
  timezone?: string;
}): Promise<{ success: boolean; error?: string; nextRunAt?: string }> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const timezone = input.timezone ?? "Asia/Shanghai";

  // 验证 cron 表达式合法,并算下次执行时间
  let nextRunAt: Date;
  try {
    const interval = CronExpressionParser.parse(input.cronExpression, {
      tz: timezone,
      currentDate: new Date(),
    });
    nextRunAt = interval.next().toDate();
  } catch (err) {
    return {
      success: false,
      error: `cron 表达式非法:${err instanceof Error ? err.message : String(err)}`,
    };
  }

  await db
    .update(scheduledJobs)
    .set({
      cronExpression: input.cronExpression,
      timezone,
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(scheduledJobs.id, input.id));

  revalidatePath(REVALIDATE_PATH);
  return { success: true, nextRunAt: nextRunAt.toISOString() };
}

/**
 * 启用 / 禁用一个 job。禁用后 scheduler 跳过,直到重新启用。
 */
export async function toggleScheduledJob(input: {
  id: string;
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  await db
    .update(scheduledJobs)
    .set({ enabled: input.enabled, updatedAt: new Date() })
    .where(eq(scheduledJobs.id, input.id));

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}

/**
 * 立即派发一次该 job 对应的事件(不等下个调度周期)。用于手动测试 / 紧急触发。
 */
export async function triggerScheduledJobNow(input: {
  id: string;
}): Promise<{ success: boolean; error?: string }> {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return { success: false, error: auth.error };

  const [job] = await db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.id, input.id))
    .limit(1);

  if (!job) return { success: false, error: "job 不存在" };

  try {
    // event_name 是 runtime DB 字符串,跳过 Inngest 严格泛型 type narrowing。
    // 业务函数已在 events.ts 注册全部 scheduled-jobs/* 类型,运行时安全。
    await (inngest.send as (payload: { name: string; data: Record<string, unknown> }) => Promise<unknown>)({
      name: job.eventName,
      data: {
        jobName: job.name,
        jobId: job.id,
        dispatchedAt: new Date().toISOString(),
        scheduledAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return {
      success: false,
      error: `派发失败:${err instanceof Error ? err.message : String(err)}`,
    };
  }

  revalidatePath(REVALIDATE_PATH);
  return { success: true };
}
