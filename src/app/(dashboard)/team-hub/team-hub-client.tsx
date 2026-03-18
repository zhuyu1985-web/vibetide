"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { GlassCard } from "@/components/shared/glass-card";
import { WorkflowPipeline } from "@/components/shared/workflow-pipeline";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { EmployeeInputBar } from "@/components/shared/employee-input-bar";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target, Clock, Users, Pencil, Check, X, Play } from "lucide-react";
import Link from "next/link";
import { StartWorkflowDialog } from "@/components/shared/start-workflow-dialog";
import type { AIEmployee, WorkflowInstance, TeamMessage, Team } from "@/lib/types";

const statusLabel: Record<string, string> = {
  working: "工作中",
  idle: "空闲",
  learning: "学习中",
  reviewing: "审核中",
};

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: { key: string; label: string; employeeSlug: string; order: number }[];
}

interface TeamHubClientProps {
  employees: AIEmployee[];
  workflows: WorkflowInstance[];
  messages: TeamMessage[];
  teams: Team[];
  templates: WorkflowTemplate[];
  organizationId: string;
}

export function TeamHubClient({
  employees,
  workflows,
  messages,
  teams,
  templates,
  organizationId,
}: TeamHubClientProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState(
    "完成「AI手机大战」和「新能源降价潮」两个P0热点的全流程内容生产，下午14:00前完成多平台适配与发布。同步启动「两会数字经济前瞻」系列策划。"
  );
  const [goalDraft, setGoalDraft] = useState(goalText);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  // Filter employees by team
  const filteredEmployees =
    selectedTeamId === "all"
      ? employees
      : employees.filter(
          (emp) => selectedTeam?.members.includes(emp.id)
        );

  const activeWorkflow = workflows[0];
  const secondWorkflow = workflows[1];

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="团队工作台"
        description="2个编辑 + 9个AI智能员工 = 全能新媒体军团"
      />

      <div className="grid grid-cols-12 gap-5">
        {/* Left: AI Team Panel */}
        <div className="col-span-3">
          <GlassCard padding="sm">
            <div className="flex items-center gap-2 px-2 py-2">
              <Users size={16} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                AI团队成员
              </h3>
              <Badge variant="secondary" className="ml-auto text-xs">
                {filteredEmployees.filter((e) => e.status === "working").length}/
                {filteredEmployees.length} 工作中
              </Badge>
            </div>

            {/* Team Selector */}
            <div className="px-2 pb-2">
              <Select
                value={selectedTeamId}
                onValueChange={setSelectedTeamId}
              >
                <SelectTrigger className="h-8 text-xs glass-input">
                  <SelectValue placeholder="选择团队" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部成员</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-1 space-y-1">
              {filteredEmployees.map((emp) => (
                <Link
                  key={emp.id}
                  href={`/employee/${emp.id}`}
                  className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors group"
                >
                  <EmployeeAvatar
                    employeeId={emp.id}
                    size="sm"
                    showStatus
                    status={emp.status}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {emp.nickname}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {emp.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                      {emp.currentTask || statusLabel[emp.status]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right: Main Content */}
        <div className="col-span-9 space-y-5">
          {/* Today's Goal */}
          <GlassCard variant="blue" padding="md">
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                今日目标
              </h3>
              {!editingGoal && (
                <button
                  className="ml-auto text-gray-400 hover:text-blue-500 transition-colors"
                  onClick={() => {
                    setGoalDraft(goalText);
                    setEditingGoal(true);
                  }}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
            {editingGoal ? (
              <div>
                <textarea
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  className="w-full text-sm text-gray-700 dark:text-gray-300 bg-white/40 dark:bg-gray-900/40 rounded-lg p-3 border border-blue-200/50 dark:border-blue-700/50 outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200 resize-none"
                  rows={3}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditingGoal(false)}
                  >
                    <X size={12} className="mr-1" />
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setGoalText(goalDraft);
                      setEditingGoal(false);
                    }}
                  >
                    <Check size={12} className="mr-1" />
                    保存
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {goalText}
              </p>
            )}
          </GlassCard>

          {/* Workflow Launch Button */}
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => setShowWorkflowDialog(true)}
            >
              <Play size={14} className="mr-1" />
              启动工作流
            </Button>
          </div>

          <StartWorkflowDialog
            open={showWorkflowDialog}
            onOpenChange={setShowWorkflowDialog}
            teams={teams}
            templates={templates}
            organizationId={organizationId}
          />

          {/* Active Workflow */}
          {activeWorkflow && (
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  当前工作流
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {activeWorkflow.topicTitle}
                </span>
              </div>
              <WorkflowPipeline steps={activeWorkflow.steps} />
            </GlassCard>
          )}

          {/* Second Workflow */}
          {secondWorkflow && (
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  进行中
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {secondWorkflow.topicTitle}
                </span>
              </div>
              <WorkflowPipeline steps={secondWorkflow.steps} />
            </GlassCard>
          )}

          {/* Team Activity Feed */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                团队动态
              </h3>
              <Badge variant="secondary" className="text-xs">
                {messages.length} 条消息
              </Badge>
            </div>
            <ActivityFeed messages={messages} maxHeight="500px" />
          </div>

          {/* Input Bar */}
          <EmployeeInputBar
            teamId={selectedTeamId !== "all" ? selectedTeamId : teams[0]?.id}
          />
        </div>
      </div>
    </div>
  );
}
