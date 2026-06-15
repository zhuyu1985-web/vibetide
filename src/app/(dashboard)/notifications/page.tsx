import { Bell } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";

export default function NotificationsPage() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="通知中心"
        description="任务进展、审批提醒与系统公告的统一入口"
      />
      <GlassCard padding="lg">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
            <Bell size={26} strokeWidth={1.7} className="text-blue-500/70" />
          </div>
          <p className="mt-4 text-sm font-medium">暂无新通知</p>
          <p className="mt-1 text-xs text-muted-foreground">
            团队协作消息、任务完成提醒和系统公告将在这里汇总展示
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
