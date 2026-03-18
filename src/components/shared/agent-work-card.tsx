"use client";

import { EmployeeAvatar } from "./employee-avatar";
import { GlassCard } from "./glass-card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { EmployeeId } from "@/lib/constants";

export interface AgentTask {
  employeeId: EmployeeId;
  taskName: string;
  progress: number;
  status: "working" | "completed" | "waiting" | "error";
  detail?: string;
}

const statusConfig = {
  working: { label: "进行中", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "已完成", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  waiting: { label: "等待中", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" },
  error: { label: "异常", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

export function AgentWorkCard({ task }: { task: AgentTask }) {
  const config = statusConfig[task.status];
  return (
    <GlassCard padding="sm" className="mb-2">
      <div className="flex items-center gap-2.5">
        <EmployeeAvatar
          employeeId={task.employeeId}
          size="sm"
          showStatus
          status={task.status === "working" ? "working" : task.status === "completed" ? "idle" : "learning"}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
              {task.taskName}
            </span>
            <Badge className={`text-[9px] ${config.color}`}>{config.label}</Badge>
          </div>
          {task.status === "working" && (
            <Progress value={task.progress} className="h-1.5" />
          )}
          {task.detail && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{task.detail}</p>
          )}
        </div>
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{task.progress}%</span>
      </div>
    </GlassCard>
  );
}

export function AgentWorkCardList({ tasks }: { tasks: AgentTask[] }) {
  return (
    <div>
      {tasks.map((task, i) => (
        <AgentWorkCard key={i} task={task} />
      ))}
    </div>
  );
}
