import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listMyResearchTasks } from "@/lib/dal/research/research-tasks";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "排队中",
  crawling: "采集中",
  analyzing: "分析中",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400",
  crawling: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  analyzing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-500",
};

export default async function TasksAdminPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(ctx.userId, ctx.organizationId, PERMISSIONS.RESEARCH_TASK_CREATE);
  if (!allowed) redirect("/research");

  const tasks = await listMyResearchTasks(ctx.organizationId, ctx.userId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">数据采集任务</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">管理后台采集任务，向数据库补充新闻数据</p>
        </div>
        <Link
          href="/research/admin/tasks/new"
          className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          新建采集任务
        </Link>
      </div>
      {tasks.length === 0 ? (
        <GlassCard variant="default" padding="lg">
          <div className="text-center text-gray-500 dark:text-gray-400 py-10">
            还没有采集任务
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Link
              key={t.id}
              href={`/research/admin/tasks/${t.id}`}
              className="block"
            >
              <GlassCard variant="interactive" padding="md" hover className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    <Badge className={STATUS_CLASS[t.status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400"}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t.crawledCount} 篇</span>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
