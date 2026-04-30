"use client";

import { CheckCircle2 } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { MissionInitData } from "@/lib/chat/parse-mission-event";
import type { AIEmployee } from "@/lib/types";

interface MissionPlanningBubbleProps {
  init: MissionInitData;
  ownerEmployee: AIEmployee | null;
  employees: AIEmployee[];
}

/**
 * 单个"规划"气泡：owner 头像 + "已规划任务" 标题 + 编号步骤列表。
 * 只在 SSE 收到 mission-init 后渲染。
 */
export function MissionPlanningBubble({
  init,
  ownerEmployee,
  employees,
}: MissionPlanningBubbleProps) {
  const ownerId = (ownerEmployee?.id ?? "leader") as EmployeeId;
  const ownerMeta = EMPLOYEE_META[ownerId];
  const ownerName = ownerEmployee?.name ?? ownerMeta?.name ?? "队长";

  return (
    <div className="flex items-start gap-3">
      <EmployeeAvatar employeeId={ownerId} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="bg-gradient-to-br from-white/90 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-blue-500 shrink-0" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {ownerName}已规划任务
            </span>
            <span className="text-xs text-muted-foreground">
              耗时 0.2s · 无 LLM 调用
            </span>
          </div>
          <ol className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
            {init.steps.map((step, idx) => {
              const empId = step.assignedEmployeeIdHint as EmployeeId | undefined;
              const empMeta = empId ? EMPLOYEE_META[empId] : undefined;
              const empName = empMeta?.name
                ?? employees.find((e) => e.id === empId)?.name
                ?? "未指派";
              return (
                <li key={`${step.phase}-${idx}`} className="leading-relaxed">
                  <span className="text-muted-foreground">{idx + 1}.</span>{" "}
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {step.name}
                  </span>
                  <span className="text-muted-foreground"> — {empName}</span>
                  {step.skillName && (
                    <>
                      <span className="text-muted-foreground"> · 使用「</span>
                      <span className="text-violet-600 font-medium">
                        {step.skillName}
                      </span>
                      <span className="text-muted-foreground">」</span>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
