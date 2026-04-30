"use client";

import { CheckCircle2 } from "lucide-react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { MissionInitData } from "@/lib/chat/parse-mission-event";
import type { AIEmployee } from "@/lib/types";
import { MissionBubbleShell } from "./mission-bubble-shell";

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
    <MissionBubbleShell employeeId={ownerId}>
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
      <div className="mt-3 text-[12px] text-gray-500 flex items-center gap-1">
        现在开始执行 →
      </div>
    </MissionBubbleShell>
  );
}
