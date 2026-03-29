"use client";

import { useState } from "react";
import { KPIComparisonBar } from "@/components/shared/kpi-comparison-bar";
import {
  AgentWorkCard,
  type AgentTask,
} from "@/components/shared/agent-work-card";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EmployeeInputBar } from "@/components/shared/employee-input-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Film,
  Headphones,
  Layout,
  Plus,
  ImageIcon,
  CheckCircle,
  Clock,
  Brain,
} from "lucide-react";
import { EMPLOYEE_META } from "@/lib/constants";
import type {
  CreationGoal,
  SuperCreationTask,
  ChatMessage,
} from "@/lib/types";

/* -- status config -- */
const statusConfig = {
  queued: { label: "排队中", color: "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50" },
  drafting: { label: "撰写中", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50" },
  reviewing: { label: "审核中", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50" },
  approved: { label: "已通过", color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50" },
  published: { label: "已发布", color: "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50" },
};

/* -- media type icons -- */
const mediaIcons = {
  article: FileText,
  video: Film,
  audio: Headphones,
  h5: Layout,
};

/* -- agent tasks (right panel) -- */
const agentTasks: AgentTask[] = [
  {
    employeeId: "xiaowen",
    taskName: "撰写深度评测",
    progress: 85,
    status: "working",
    detail: "正在写第4章节...",
  },
  {
    employeeId: "xiaojian",
    taskName: "制作60秒速览视频",
    progress: 90,
    status: "working",
    detail: "添加字幕中...",
  },
  {
    employeeId: "xiaoshen",
    taskName: "质量终审",
    progress: 30,
    status: "working",
    detail: "事实核查进行中",
  },
];

interface SuperCreationClientProps {
  goal: CreationGoal | null;
  tasks: SuperCreationTask[];
  chatHistory: ChatMessage[];
}

export function SuperCreationClient({
  goal,
  tasks: superCreationTasks,
  chatHistory,
}: SuperCreationClientProps) {
  const [selectedTask, setSelectedTask] = useState<SuperCreationTask | null>(
    superCreationTasks[0] ?? null
  );
  const [mediaFilter, setMediaFilter] = useState("all");

  const filteredTasks =
    mediaFilter === "all"
      ? superCreationTasks
      : superCreationTasks.filter((t) => t.mediaType === mediaFilter);

  const selectedStatus = selectedTask ? statusConfig[selectedTask.status] : null;
  const assigneeMeta = selectedTask ? EMPLOYEE_META[selectedTask.assignee] : null;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* -- Page Header -- */}
      <PageHeader
        title="超级创作"
        description="编辑变身主编，AI团队协作干活"
      />

      {/* -- KPI Comparison Bar -- */}
      <KPIComparisonBar
        items={[
          { label: "单篇耗时", before: "2-3h", after: "30min" },
          { label: "日产量", before: "3-5条", after: "15-20条" },
          { label: "质量评分", before: "78", after: "92" },
          { label: "内容类型", before: "图文", after: "全媒体" },
        ]}
      />

      {/* -- Goal Input Area -- */}
      <GlassCard variant="blue" className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs text-green-700 font-medium">
              当前活跃目标
            </span>
          </div>
          <Button size="sm" className="h-7 text-xs">
            <Plus size={12} className="mr-1" />
            开始新创作
          </Button>
        </div>
        <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-2">
          {goal?.title || "暂无活跃目标"}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{goal?.description || ""}</p>
      </GlassCard>

      {/* -- Three-column layout -- */}
      <div className="grid grid-cols-12 gap-4">
        {/* -- Left: Task list (col-3) -- */}
        <div className="col-span-3">
          <GlassCard padding="sm">
            <Tabs
              value={mediaFilter}
              onValueChange={setMediaFilter}
              className="mb-3"
            >
              <TabsList className="h-8 w-full">
                <TabsTrigger value="all" className="text-xs h-6 px-2">
                  全部
                </TabsTrigger>
                <TabsTrigger value="article" className="text-xs h-6 px-2">
                  图文
                </TabsTrigger>
                <TabsTrigger value="video" className="text-xs h-6 px-2">
                  视频
                </TabsTrigger>
                <TabsTrigger value="h5" className="text-xs h-6 px-2">
                  H5
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const isSelected = task.id === selectedTask?.id;
                const status = statusConfig[task.status];
                const MediaIcon = mediaIcons[task.mediaType];

                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/50 ring-1 ring-blue-200"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <MediaIcon
                        size={14}
                        className={
                          isSelected ? "text-blue-500" : "text-gray-400 dark:text-gray-500"
                        }
                      />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate flex-1">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge
                        className={`text-[9px] ${status.color}`}
                      >
                        {status.label}
                      </Badge>
                      {task.wordCount > 0 && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {task.wordCount}字
                        </span>
                      )}
                    </div>

                    {task.status === "drafting" && (
                      <Progress value={task.progress} className="h-1 mb-1.5" />
                    )}

                    <div className="flex items-center gap-1.5">
                      <EmployeeAvatar
                        employeeId={task.assignee}
                        size="xs"
                      />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {task.aiResponsible}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassCard>
        </div>

        {/* -- Center: Editor (col-6) -- */}
        <div className="col-span-6">
          <GlassCard>
            {!selectedTask ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-500">
                <p className="text-sm">暂无创作任务</p>
                <p className="text-xs mt-1">请先创建一个创作目标</p>
              </div>
            ) : (
            <>
            {/* Editor header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {selectedStatus && (
                <Badge className={`text-[10px] ${selectedStatus.color}`}>
                  {selectedStatus.label}
                </Badge>
                )}
                {selectedTask.wordCount > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {selectedTask.wordCount}字
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <EmployeeAvatar
                  employeeId={selectedTask.assignee}
                  size="xs"
                  showStatus
                  status="working"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {assigneeMeta?.nickname}
                </span>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
              {selectedTask.content.headline}
            </h2>

            {/* Body */}
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line mb-4 min-h-[120px]">
              {selectedTask.content.body || (
                <span className="text-gray-400 dark:text-gray-500 italic">等待AI开始撰写...</span>
              )}
            </div>

            {/* Image notes */}
            {selectedTask.content.imageNotes &&
              selectedTask.content.imageNotes.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                    <ImageIcon size={12} />
                    配图说明
                  </p>
                  <div className="space-y-1.5">
                    {selectedTask.content.imageNotes.map((note, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0">
                          <ImageIcon size={14} className="text-gray-400 dark:text-gray-500" />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Chat / Dialog section */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                对话式改稿
              </h4>

              <div className="space-y-3 max-h-[320px] overflow-y-auto mb-3 pr-1">
                {chatHistory.map((msg) => {
                  const isEditor = msg.role === "editor";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isEditor ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`flex gap-2 max-w-[85%] ${
                          isEditor ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {!isEditor && msg.employeeId && (
                          <EmployeeAvatar
                            employeeId={msg.employeeId}
                            size="xs"
                            className="mt-1 shrink-0"
                          />
                        )}
                        <div>
                          <div
                            className={`flex items-center gap-1.5 mb-0.5 ${
                              isEditor ? "justify-end" : "justify-start"
                            }`}
                          >
                            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                              {msg.name}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {msg.timestamp}
                            </span>
                          </div>
                          <div
                            className={`text-xs leading-relaxed px-3 py-2 rounded-xl ${
                              isEditor
                                ? "bg-blue-500 text-white rounded-br-sm"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-bl-sm"
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <EmployeeInputBar />
            </div>
            </>
            )}
          </GlassCard>
        </div>

        {/* -- Right: AI workers & advisor (col-3) -- */}
        <div className="col-span-3 space-y-4">
          {/* Agent work cards */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
              <Clock size={12} />
              当前AI工作状态
            </h4>
            {agentTasks.map((task, i) => (
              <AgentWorkCard key={i} task={task} />
            ))}
          </div>

          {/* Channel advisor style constraint card */}
          <GlassCard padding="sm">
            <div className="flex items-center gap-2 mb-2">
              <EmployeeAvatar employeeId="advisor" size="sm" />
              <div>
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                  {EMPLOYEE_META.advisor.nickname}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {EMPLOYEE_META.advisor.title}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Brain size={12} className="text-pink-400" />
                风格约束建议
              </p>
              {selectedTask?.advisorNotes &&
              selectedTask.advisorNotes.length > 0 ? (
                selectedTask.advisorNotes.map((note, i) => (
                  <div
                    key={i}
                    className="text-[11px] text-gray-600 dark:text-gray-400 p-2 rounded-lg bg-pink-50/60 dark:bg-pink-950/50"
                  >
                    {note}
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic p-2">
                  暂无风格建议
                </p>
              )}
            </div>
          </GlassCard>

          {/* Review status card (when task is in reviewing) */}
          {selectedTask?.status === "reviewing" && (
            <GlassCard padding="sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={14} className="text-amber-500" />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                  审核进度
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">事实核查</span>
                  <Badge className="text-[9px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50">
                    进行中
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">敏感内容检测</span>
                  <Badge className="text-[9px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50">
                    已通过
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">SEO优化检查</span>
                  <Badge className="text-[9px] text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                    等待中
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <EmployeeAvatar
                    employeeId="xiaoshen"
                    size="xs"
                    showStatus
                    status="reviewing"
                  />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    小审正在审核中...
                  </span>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
