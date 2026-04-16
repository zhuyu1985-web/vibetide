import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";
import { hasPermission, PERMISSIONS } from "@/lib/rbac";
import { listMyResearchTasks } from "@/lib/dal/research/research-tasks";
import { Badge } from "@/components/ui/badge";
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
  pending: "bg-gray-100 text-gray-700",
  crawling: "bg-blue-100 text-blue-700",
  analyzing: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export default async function TasksAdminPage() {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) redirect("/login");
  const allowed = await hasPermission(ctx.userId, ctx.organizationId, PERMISSIONS.RESEARCH_TASK_CREATE);
  if (!allowed) redirect("/research");

  const tasks = await listMyResearchTasks(ctx.organizationId, ctx.userId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">数据采集任务</h1>
          <p className="text-sm text-muted-foreground mt-1">管理后台采集任务，向数据库补充新闻数据</p>
        </div>
        <Link
          href="/research/admin/tasks/new"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          新建采集任务
        </Link>
      </div>
      {tasks.length === 0 ? (
        <div className="rounded-xl bg-card p-12 text-center text-muted-foreground">
          还没有采集任务
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Link
              key={t.id}
              href={`/research/admin/tasks/${t.id}`}
              className="block rounded-xl bg-card p-4 hover:bg-accent transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{t.name}</span>
                  <Badge className={STATUS_CLASS[t.status] ?? "bg-gray-100 text-gray-700"}>
                    {STATUS_LABELS[t.status] ?? t.status}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">{t.crawledCount} 篇</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
