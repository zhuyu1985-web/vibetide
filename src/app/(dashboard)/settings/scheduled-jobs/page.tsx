import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listScheduledJobsWithRelations } from "@/lib/dal/scheduled-jobs";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { ScheduledJobsClient } from "./scheduled-jobs-client";

export const dynamic = "force-dynamic";

/**
 * 定时任务管理 —— 全项目所有 cron job 的统一配置入口。
 *
 * 业务函数从订阅 cron 改为订阅 event,由 master scheduler
 * (src/inngest/functions/scheduler/scheduled-jobs-runner.ts) 每分钟扫
 * scheduled_jobs 表 + 按 cron 表达式判断派发对应 event。
 *
 * 改 cron 表达式 / toggle enabled / 立即运行 都不需要重启 Next.js,
 * 下个分钟 scheduler tick 就会按新配置工作。
 *
 * 普通用户请使用 /cowork/schedules（本组织工作流定时任务）。
 */
export default async function ScheduledJobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) {
    return (
      <div className="mx-auto flex max-w-lg items-center justify-center p-8">
        <GlassCard className="w-full p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-lg font-semibold text-foreground">需要超级管理员权限</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            此页管理平台级定时任务。本组织的工作流定时任务请前往协作侧栏「定时任务」。
          </p>
          <Button asChild variant="ghost" className="mt-6">
            <Link href="/cowork/schedules">查看我的定时任务</Link>
          </Button>
        </GlassCard>
      </div>
    );
  }

  const jobs = await listScheduledJobsWithRelations();

  return <ScheduledJobsClient jobs={jobs} />;
}
