"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScheduleListClient } from "@/app/(dashboard)/workflows/[id]/schedule-list-client";
import type { ScheduledJob } from "@/db/schema/scheduled-jobs";
import type { WorkflowTemplateRow } from "@/db/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: WorkflowTemplateRow;
  schedules: ScheduledJob[];
  onSchedulesChange: (next: ScheduledJob[]) => void;
}

/**
 * 编辑器里的"定时任务"管理 Sheet —— 复用详情页 tab 上同一个 ScheduleListClient,
 * 让用户在不离开编辑器的情况下完成 CRUD 全闭环。
 *
 * onSchedulesChange 把列表变化向上回传给 WorkflowEditor 同步 TriggerCard 计数。
 */
export function ScheduleSheet({
  open,
  onOpenChange,
  workflow,
  schedules,
  onSchedulesChange,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[1100px] overflow-y-auto p-6"
      >
        <SheetHeader className="px-0">
          <SheetTitle>定时任务 · {workflow.name}</SheetTitle>
          <SheetDescription>
            为该场景挂载 0..N 条 cron 调度,到点自动按预设参数启动 mission。
            手动启动入口始终保留,与定时任务并行存在。
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4">
          <ScheduleListClient
            workflow={workflow}
            schedules={schedules}
            onSchedulesChange={onSchedulesChange}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
