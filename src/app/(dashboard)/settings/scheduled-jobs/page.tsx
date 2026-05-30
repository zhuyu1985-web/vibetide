import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listScheduledJobsWithRelations } from "@/lib/dal/scheduled-jobs";
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
 */
export default async function ScheduledJobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperAdmin) {
    // 非 super admin 不能进入此页(可改成 403 页面,这里简化为跳首页)
    redirect("/home");
  }

  const jobs = await listScheduledJobsWithRelations();

  return <ScheduledJobsClient jobs={jobs} />;
}
