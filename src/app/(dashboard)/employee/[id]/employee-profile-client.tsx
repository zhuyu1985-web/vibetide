"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { SkillBrowserDialog } from "@/components/shared/skill-browser-dialog";
import { KBBrowserDialog } from "@/components/shared/kb-browser-dialog";
import { LearningNoteDialog } from "@/components/shared/learning-note-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  BookOpen,
  Sliders,
  Shield,
  TrendingUp,
  GraduationCap,
  CheckCircle,
  Gauge,
  Clock,
  Star,
  Plus,
  X,
  Save,
  Loader2,
  Database,
  History,
  Dna,
  FlaskConical,
  Combine,
  Eye,
  ChevronDown,
  ChevronUp,
  Wrench,
  Pencil,
  Zap,
} from "lucide-react";
import {
  unbindSkillFromEmployee,
  unbindKnowledgeBaseFromEmployee,
  updateSkillLevel,
  updateWorkPreferences,
  updateAuthorityLevel,
  updateAutoActions,
  updateEmployeeProfile,
} from "@/app/actions/employees";
import { previewSystemPrompt } from "@/app/actions/employee-advanced";
import { triggerLearningFromFeedback } from "@/app/actions/learning";
import { READ_ONLY_TOOL_NAMES, TOOL_DESCRIPTIONS } from "@/lib/constants";
import { PerformanceCharts } from "./performance-charts";
import { EvolutionTab } from "./evolution-tab";
import { VersionHistory } from "./version-history";
import { SkillTestDialog } from "./skill-test-dialog";
import { SkillComboManager } from "./skill-combo-manager";
import type { EmployeeFullProfile, Skill, KnowledgeBaseInfo } from "@/lib/types";
import type { SkillRecommendation } from "@/lib/dal/skills";
import type { WorkflowTemplateRow } from "@/db/types";
import { WorkflowLaunchDialog } from "@/components/workflows/workflow-launch-dialog";
import { WorkflowCardMenu } from "@/components/workflows/workflow-card-menu";
import * as LucideIcons from "lucide-react";
import { FileText as FileTextIcon, type LucideIcon } from "lucide-react";

const statusLabel: Record<string, string> = {
  working: "工作中",
  idle: "空闲",
  learning: "学习中",
  reviewing: "审核中",
};

const statusColor: Record<string, string> = {
  working: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  idle: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  learning: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  reviewing: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

const authorityLabels: Record<string, string> = {
  observer: "观察者",
  advisor: "顾问",
  executor: "执行者",
  coordinator: "协调者",
};

const authorityDescriptions: Record<string, string> = {
  observer: "只能查看任务和数据，不能执行操作",
  advisor: "可以提出建议，但需要审批才能执行",
  executor: "可以自主执行分配的任务",
  coordinator: "可以协调其他员工并分配任务",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
interface EmployeeProfileClientProps {
  employee: EmployeeFullProfile;
  availableSkills: Skill[];
  availableKBs?: KnowledgeBaseInfo[];
  recommendations?: SkillRecommendation[];
  performanceTrend?: any[];
  feedbackStats?: { accepts: number; rejects: number; edits: number; rate: number };
  patterns?: any[];
  evolutionData?: any[];
  attributions?: any[];
  configVersions?: any[];
  skillCombos?: any[];
  recentMemories?: Array<{
    id: string;
    memoryType: string;
    content: string;
    source: string | null;
    importance: number;
    createdAt: string;
  }>;
  unprocessedFeedbackCount?: number;
  /**
   * B.1 — workflow_templates bound to this employee via `defaultTeam`.
   * These ARE the employee's scenarios in the unified model (场景 = 工作流).
   */
  employeeWorkflows?: WorkflowTemplateRow[];
  /** Whether the current user can write scenarios (ai:manage permission).
   * For now we derive this lazily inside the tab via the server action's
   * own guard — no gating on the client. */
  canManageScenarios?: boolean;
  /** Whether the current user is admin/owner/superAdmin — shows ⋯ menu on workflow cards. */
  canManage?: boolean;
}

export function EmployeeProfileClient({
  employee,
  availableSkills,
  availableKBs = [],
  recommendations = [],
  performanceTrend = [],
  feedbackStats = { accepts: 0, rejects: 0, edits: 0, rate: 0 },
  patterns = [],
  evolutionData = [],
  attributions = [],
  configVersions = [],
  skillCombos = [],
  recentMemories = [],
  unprocessedFeedbackCount = 0,
  employeeWorkflows = [],
  canManageScenarios = true,
  canManage = false,
}: EmployeeProfileClientProps) {
  const router = useRouter();
  const [skillBrowserOpen, setSkillBrowserOpen] = useState(false);
  const [kbBrowserOpen, setKbBrowserOpen] = useState(false);
  const [savingSkill, setSavingSkill] = useState<string | null>(null);
  const [unbindingSkill, setUnbindingSkill] = useState<string | null>(null);
  const [unbindingKB, setUnbindingKB] = useState<string | null>(null);
  const [skillTestOpen, setSkillTestOpen] = useState(false);
  const [learningNoteOpen, setLearningNoteOpen] = useState(false);
  const [learningFromFeedback, setLearningFromFeedback] = useState(false);
  const [promptPreviewOpen, setPromptPreviewOpen] = useState(false);
  const [promptPreview, setPromptPreview] = useState<string | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  // Preferences form state
  const [prefsEditing, setPrefsEditing] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    proactivity: employee.workPreferences?.proactivity || "主动",
    reportingFrequency: employee.workPreferences?.reportingFrequency || "实时",
    autonomyLevel: employee.workPreferences?.autonomyLevel || 50,
    communicationStyle: employee.workPreferences?.communicationStyle || "简洁高效",
    workingHours: employee.workPreferences?.workingHours || "7x24小时",
  });

  // Permissions state
  const [permSaving, setPermSaving] = useState(false);
  const [autoActions, setAutoActions] = useState<string[]>(employee.autoActions);
  const [needApproval, setNeedApproval] = useState<string[]>(employee.needApprovalActions);
  const [newAutoAction, setNewAutoAction] = useState("");
  const [newApprovalAction, setNewApprovalAction] = useState("");

  const handleUnbindSkill = async (skillId: string) => {
    setUnbindingSkill(skillId);
    try {
      await unbindSkillFromEmployee(employee.dbId, skillId);
      router.refresh();
    } catch (err) {
      console.error("Failed to unbind skill:", err);
    } finally {
      setUnbindingSkill(null);
    }
  };

  const handleUnbindKB = async (kbId: string) => {
    setUnbindingKB(kbId);
    try {
      await unbindKnowledgeBaseFromEmployee(employee.dbId, kbId);
      router.refresh();
    } catch (err) {
      console.error("Failed to unbind KB:", err);
    } finally {
      setUnbindingKB(null);
    }
  };

  const handleSkillLevelChange = async (skillId: string, level: number) => {
    setSavingSkill(skillId);
    try {
      await updateSkillLevel(employee.dbId, skillId, level);
      router.refresh();
    } catch (err) {
      console.error("Failed to update skill level:", err);
    } finally {
      setSavingSkill(null);
    }
  };

  const handleSavePrefs = async () => {
    setPrefsSaving(true);
    try {
      await updateWorkPreferences(employee.dbId, prefs);
      setPrefsEditing(false);
      router.refresh();
    } catch (err) {
      console.error("Failed to save preferences:", err);
    } finally {
      setPrefsSaving(false);
    }
  };

  const handleAuthorityChange = async (level: string) => {
    setPermSaving(true);
    try {
      await updateAuthorityLevel(
        employee.dbId,
        level as "observer" | "advisor" | "executor" | "coordinator"
      );
      router.refresh();
    } catch (err) {
      console.error("Failed to update authority:", err);
    } finally {
      setPermSaving(false);
    }
  };

  const handleSaveActions = async () => {
    setPermSaving(true);
    try {
      await updateAutoActions(employee.dbId, autoActions, needApproval);
      router.refresh();
    } catch (err) {
      console.error("Failed to save actions:", err);
    } finally {
      setPermSaving(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Profile Header */}
      <GlassCard className="mb-6">
        <div className="flex items-start gap-6">
          <EmployeeAvatar
            employeeId={employee.id}
            size="xl"
            showStatus
            status={employee.status}
          />
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {employee.nickname}
              </h1>
              <span className="text-sm text-gray-500 dark:text-gray-400">{employee.title}</span>
              <Badge
                className={`${statusColor[employee.status]} text-xs ml-2`}
              >
                {statusLabel[employee.status]}
              </Badge>
              {!employee.isPreset && (
                <>
                  <Badge variant="outline" className="text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700/50">
                    自定义
                  </Badge>
                  <button
                    onClick={() => setEditProfileOpen(true)}
                    className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="编辑员工信息"
                  >
                    <Pencil size={14} />
                  </button>
                </>
              )}
              <Badge variant="secondary" className="text-xs ml-1">
                {authorityLabels[employee.authorityLevel]}
              </Badge>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-4">
              &ldquo;{employee.motto}&rdquo;
            </p>
            {employee.currentTask && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span className="font-medium">当前任务：</span>
                {employee.currentTask}
              </p>
            )}
            <div className="grid grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-green-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {employee.stats.tasksCompleted}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">累计任务</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Gauge size={16} className="text-blue-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {employee.stats.accuracy}%
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">准确率</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-amber-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {employee.stats.avgResponseTime}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">平均响应</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Star size={16} className="text-yellow-500" />
                <div>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {employee.stats.satisfaction}%
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">满意度</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* B.1 Unified Scenario Workflow — workflow_templates bound to this
          employee (场景 = 工作流). Clicking a card directly starts a mission
          using `workflowTemplateId` dual-write. These are daily-capability
          cards, not per-article pickers. */}
      {employeeWorkflows.length > 0 && (
        <EmployeeWorkflowsSection
          workflows={employeeWorkflows}
          employeeNickname={employee.nickname}
          canManage={canManage}
        />
      )}

      {/* Legacy scenario workbench removed 2026-04-20 — employee_scenarios
           table dropped (migration 20260420). 场景 = 工作流 in the unified
           model; see EmployeeScenarios tab above for workflow_templates. */}

      {/* Tabs */}
      <Tabs defaultValue="skills">
        <TabsList className="mt-6 mb-4">
          <TabsTrigger value="skills" className="text-xs gap-1">
            <Settings size={14} />
            技能配置
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs gap-1">
            <BookOpen size={14} />
            知识库
          </TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs gap-1">
            <Sliders size={14} />
            工作偏好
          </TabsTrigger>
          <TabsTrigger value="permissions" className="text-xs gap-1">
            <Shield size={14} />
            权限设置
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-xs gap-1">
            <TrendingUp size={14} />
            绩效数据
          </TabsTrigger>
          <TabsTrigger value="learning" className="text-xs gap-1">
            <GraduationCap size={14} />
            学习记录
          </TabsTrigger>
          <TabsTrigger value="evolution" className="text-xs gap-1">
            <Dna size={14} />
            进化
          </TabsTrigger>
          <TabsTrigger value="versions" className="text-xs gap-1">
            <History size={14} />
            版本历史
          </TabsTrigger>
        </TabsList>

        {/* Skills Tab */}
        <TabsContent value="skills">
          <div className="mb-4 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setSkillBrowserOpen(true)}
            >
              <Plus size={14} className="mr-1" />
              添加技能
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setSkillTestOpen(true)}
            >
              <FlaskConical size={14} className="mr-1" />
              技能测试
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employee.skills.map((skill) => {
              const isCore = skill.bindingType === "core";
              return (
                <GlassCard key={skill.id} variant="interactive" padding="md">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {skill.name}
                    </h4>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        v{skill.version}
                      </Badge>
                      {isCore ? (
                        <Badge className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ml-1">
                          核心
                        </Badge>
                      ) : (
                        <button
                          className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors ml-1"
                          onClick={() => handleUnbindSkill(skill.id)}
                          disabled={unbindingSkill === skill.id}
                          title="解绑技能"
                        >
                          {unbindingSkill === skill.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <X size={12} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {skill.description}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 dark:text-gray-500 w-10">熟练度</span>
                      <Slider
                        defaultValue={[skill.level]}
                        min={0}
                        max={100}
                        step={1}
                        className="flex-1"
                        onValueCommit={(value: number[]) =>
                          handleSkillLevelChange(skill.id, value[0])
                        }
                      />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-8 text-right">
                        {skill.level}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {skill.type === "builtin"
                          ? "内置"
                          : skill.type === "plugin"
                            ? "插件"
                            : "自定义"}
                      </Badge>
                      {skill.bindingType === "knowledge" && (
                        <Badge variant="outline" className="text-[10px] text-indigo-600 dark:text-indigo-400">
                          知识型
                        </Badge>
                      )}
                    </div>
                    {savingSkill === skill.id && (
                      <span className="text-[10px] text-blue-500 flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin" />
                        保存中
                      </span>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge">
          <div className="mb-4">
            <Button
              size="sm"
              variant="outline"
              className="text-xs"
              onClick={() => setKbBrowserOpen(true)}
            >
              <Plus size={14} className="mr-1" />
              添加知识库
            </Button>
          </div>
          {employee.knowledgeBases.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employee.knowledgeBases.map((kb) => (
                <GlassCard key={kb.id} padding="md">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center shrink-0">
                      <Database size={18} className="text-indigo-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {kb.name}
                        </h4>
                        <button
                          className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors ml-1"
                          onClick={() => handleUnbindKB(kb.id)}
                          disabled={unbindingKB === kb.id}
                          title="解绑知识库"
                        >
                          {unbindingKB === kb.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <X size={12} />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {kb.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {kb.type === "general"
                            ? "通用"
                            : kb.type === "channel_style"
                              ? "频道风格"
                              : kb.type === "sensitive_topics"
                                ? "敏感话题"
                                : "领域专业"}
                        </Badge>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {kb.documentCount} 篇文档
                        </span>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <GlassCard>
              <div className="text-center py-12">
                <BookOpen size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  暂无知识库
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  点击上方"添加知识库"按钮为 {employee.nickname} 绑定知识库
                </p>
              </div>
            </GlassCard>
          )}
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <div className="space-y-4">
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  工作偏好设置
                </h3>
                {!prefsEditing ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setPrefsEditing(true)}
                  >
                    编辑
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setPrefsEditing(false)}
                    >
                      取消
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs"
                      onClick={handleSavePrefs}
                      disabled={prefsSaving}
                    >
                      {prefsSaving ? (
                        <Loader2 size={12} className="mr-1 animate-spin" />
                      ) : (
                        <Save size={12} className="mr-1" />
                      )}
                      保存
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-5">
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">主动性</Label>
                  {prefsEditing ? (
                    <Select
                      value={prefs.proactivity}
                      onValueChange={(v) =>
                        setPrefs({ ...prefs, proactivity: v })
                      }
                    >
                      <SelectTrigger className="mt-1 glass-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="被动">被动 - 仅响应指令</SelectItem>
                        <SelectItem value="适中">适中 - 必要时主动</SelectItem>
                        <SelectItem value="主动">主动 - 积极提出建议</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {prefs.proactivity}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    影响 AI 是否主动提出建议和发现问题。被动模式下仅响应明确指令。
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">汇报频率</Label>
                  {prefsEditing ? (
                    <Select
                      value={prefs.reportingFrequency}
                      onValueChange={(v) =>
                        setPrefs({ ...prefs, reportingFrequency: v })
                      }
                    >
                      <SelectTrigger className="mt-1 glass-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="实时">实时</SelectItem>
                        <SelectItem value="每小时">每小时</SelectItem>
                        <SelectItem value="每4小时">每4小时</SelectItem>
                        <SelectItem value="每日">每日</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {prefs.reportingFrequency}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    控制 AI 进展汇报的间隔，影响团队消息中状态更新的频率。
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">
                    自主权等级: {prefs.autonomyLevel}%
                  </Label>
                  {prefsEditing ? (
                    <Slider
                      value={[prefs.autonomyLevel]}
                      min={0}
                      max={100}
                      step={5}
                      className="mt-2"
                      onValueChange={(v: number[]) =>
                        setPrefs({ ...prefs, autonomyLevel: v[0] })
                      }
                    />
                  ) : (
                    <Progress value={prefs.autonomyLevel} className="mt-2 h-2" />
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    影响审批触发阈值，低自主权时更多操作需要人工审批确认。
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">沟通风格</Label>
                  {prefsEditing ? (
                    <Input
                      value={prefs.communicationStyle}
                      onChange={(e) =>
                        setPrefs({ ...prefs, communicationStyle: e.target.value })
                      }
                      className="mt-1 glass-input"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {prefs.communicationStyle}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    影响 AI 输出的语言风格，如"简洁高效"、"详细严谨"、"活泼亲切"等。
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 dark:text-gray-400">工作时间</Label>
                  {prefsEditing ? (
                    <Input
                      value={prefs.workingHours}
                      onChange={(e) =>
                        setPrefs({ ...prefs, workingHours: e.target.value })
                      }
                      className="mt-1 glass-input"
                    />
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      {prefs.workingHours}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                    设定 AI 员工的活跃时间段，影响任务调度优先级。
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Prompt Preview */}
            <GlassCard>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <Eye size={14} className="text-purple-500" />
                  系统提示词预览
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={promptLoading}
                  onClick={async () => {
                    if (promptPreview) {
                      setPromptPreviewOpen(!promptPreviewOpen);
                      return;
                    }
                    setPromptLoading(true);
                    try {
                      const res = await previewSystemPrompt(employee.dbId);
                      setPromptPreview(res.systemPrompt);
                      setPromptPreviewOpen(true);
                    } catch (err) {
                      console.error("Failed to load prompt:", err);
                    } finally {
                      setPromptLoading(false);
                    }
                  }}
                >
                  {promptLoading ? (
                    <Loader2 size={12} className="mr-1 animate-spin" />
                  ) : promptPreviewOpen ? (
                    <ChevronUp size={12} className="mr-1" />
                  ) : (
                    <ChevronDown size={12} className="mr-1" />
                  )}
                  {promptPreviewOpen ? "收起" : "查看完整提示词"}
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                以上偏好设置会注入到 AI 员工的 7 层系统提示词中，直接影响其行为表现。
              </p>
              {promptPreviewOpen && promptPreview && (
                <pre className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700/50 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed max-h-[400px] overflow-y-auto">
                  {promptPreview}
                </pre>
              )}
            </GlassCard>
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <div className="space-y-4">
            {/* Authority Level */}
            <GlassCard>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
                权限等级
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {(
                  ["observer", "advisor", "executor", "coordinator"] as const
                ).map((level) => (
                  <button
                    key={level}
                    className={`p-3 rounded-xl border transition-all text-left ${
                      employee.authorityLevel === level
                        ? "border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-700"
                        : "border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700/50 hover:bg-blue-50/30 dark:hover:bg-blue-900/20"
                    }`}
                    onClick={() => handleAuthorityChange(level)}
                    disabled={permSaving}
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {authorityLabels[level]}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                      {authorityDescriptions[level]}
                    </p>
                  </button>
                ))}
              </div>
            </GlassCard>

            {/* Tool Access Preview */}
            <GlassCard>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Wrench size={14} className="text-blue-500" />
                工具访问权限预览
              </h3>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">
                根据当前权限等级「{authorityLabels[employee.authorityLevel]}」，该员工可使用以下工具：
              </p>
              {employee.authorityLevel === "observer" ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  观察者无权使用任何工具
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {employee.skills.map((skill) => {
                    const readOnlySet = new Set<string>(READ_ONLY_TOOL_NAMES);
                    const isReadOnly = readOnlySet.has(skill.name);
                    const isAccessible =
                      employee.authorityLevel === "executor" ||
                      employee.authorityLevel === "coordinator" ||
                      (employee.authorityLevel === "advisor" && isReadOnly);

                    return (
                      <div
                        key={skill.id}
                        className={`px-2.5 py-1.5 rounded-lg text-xs ${
                          isAccessible
                            ? "bg-green-50 dark:bg-green-950/25 text-green-700 dark:text-green-400 border border-green-200/50 dark:border-green-800/30"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border border-gray-200/50 dark:border-gray-700/30 line-through"
                        }`}
                        title={TOOL_DESCRIPTIONS[skill.name] || skill.description}
                      >
                        {skill.name}
                        {isReadOnly && isAccessible && (
                          <span className="ml-1 text-[10px] opacity-60">只读</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            {/* Auto Actions */}
            <GlassCard>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                自主执行操作
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {autoActions.map((action, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-xs pr-1 gap-1"
                  >
                    {action}
                    <button
                      className="ml-1 hover:text-red-500"
                      onClick={() =>
                        setAutoActions(autoActions.filter((_, j) => j !== i))
                      }
                    >
                      <X size={10} />
                    </button>
                  </Badge>
                ))}
                {autoActions.length === 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">暂无</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="添加自主操作..."
                  value={newAutoAction}
                  onChange={(e) => setNewAutoAction(e.target.value)}
                  className="flex-1 h-8 text-xs glass-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newAutoAction.trim()) {
                      setAutoActions([...autoActions, newAutoAction.trim()]);
                      setNewAutoAction("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (newAutoAction.trim()) {
                      setAutoActions([...autoActions, newAutoAction.trim()]);
                      setNewAutoAction("");
                    }
                  }}
                >
                  <Plus size={12} />
                </Button>
              </div>
            </GlassCard>

            {/* Need Approval Actions */}
            <GlassCard>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                需审批操作
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {needApproval.map((action, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs pr-1 gap-1 border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400"
                  >
                    {action}
                    <button
                      className="ml-1 hover:text-red-500"
                      onClick={() =>
                        setNeedApproval(needApproval.filter((_, j) => j !== i))
                      }
                    >
                      <X size={10} />
                    </button>
                  </Badge>
                ))}
                {needApproval.length === 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">暂无</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="添加需审批操作..."
                  value={newApprovalAction}
                  onChange={(e) => setNewApprovalAction(e.target.value)}
                  className="flex-1 h-8 text-xs glass-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newApprovalAction.trim()) {
                      setNeedApproval([
                        ...needApproval,
                        newApprovalAction.trim(),
                      ]);
                      setNewApprovalAction("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (newApprovalAction.trim()) {
                      setNeedApproval([
                        ...needApproval,
                        newApprovalAction.trim(),
                      ]);
                      setNewApprovalAction("");
                    }
                  }}
                >
                  <Plus size={12} />
                </Button>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  className="text-xs"
                  onClick={handleSaveActions}
                  disabled={permSaving}
                >
                  {permSaving ? (
                    <Loader2 size={12} className="mr-1 animate-spin" />
                  ) : (
                    <Save size={12} className="mr-1" />
                  )}
                  保存操作配置
                </Button>
              </div>
            </GlassCard>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard
              label="本月任务"
              value={Math.round(employee.stats.tasksCompleted / 12)}
              change={8.5}
            />
            <StatCard
              label="准确率"
              value={`${employee.stats.accuracy}%`}
              change={1.2}
            />
            <StatCard
              label="响应时间"
              value={employee.stats.avgResponseTime}
              change={-5.3}
            />
            <StatCard
              label="满意度"
              value={`${employee.stats.satisfaction}%`}
              change={2.1}
            />
          </div>
          <PerformanceCharts trendData={performanceTrend} />
        </TabsContent>

        {/* Learning Tab */}
        <TabsContent value="learning">
          <div className="space-y-4">
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => setLearningNoteOpen(true)}
              >
                <Plus size={14} className="mr-1" />
                添加学习笔记
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                disabled={learningFromFeedback}
                onClick={async () => {
                  setLearningFromFeedback(true);
                  try {
                    await triggerLearningFromFeedback(employee.dbId);
                    router.refresh();
                  } catch (err) {
                    console.error("Learning failed:", err);
                  } finally {
                    setLearningFromFeedback(false);
                  }
                }}
              >
                {learningFromFeedback ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <GraduationCap size={14} className="mr-1" />
                )}
                从反馈中学习
              </Button>
              {unprocessedFeedbackCount > 0 && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400">
                  {unprocessedFeedbackCount} 条反馈待处理
                </span>
              )}
            </div>

            {/* Learned Patterns */}
            {Object.keys(employee.learnedPatterns).length > 0 && (
              <GlassCard>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                  已学习模式
                </h3>
                <div className="space-y-3">
                  {Object.entries(employee.learnedPatterns).map(([key, pattern]) => (
                    <div key={key} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">{key}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          来源: {pattern.source} · 次数: {pattern.count} · 最近: {pattern.lastSeen}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {/* Recent Memories */}
            <GlassCard>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
                最近记忆
              </h3>
              {recentMemories.length > 0 ? (
                <div className="space-y-3">
                  {recentMemories.map((memory) => (
                    <div key={memory.id} className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        memory.memoryType === "pattern" ? "bg-purple-400" :
                        memory.memoryType === "preference" ? "bg-amber-400" :
                        "bg-blue-400"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{memory.content}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {memory.memoryType === "feedback" ? "反馈" :
                             memory.memoryType === "pattern" ? "模式" :
                             "偏好"}
                          </Badge>
                          {memory.source && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              {memory.source}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {new Date(memory.createdAt).toLocaleDateString("zh-CN")}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            重要性: {Math.round(memory.importance * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400 dark:text-gray-500 py-4">
                  暂无记忆记录，可通过"添加学习笔记"或"从反馈中学习"来积累
                </p>
              )}
            </GlassCard>
          </div>
        </TabsContent>

        {/* Evolution Tab */}
        <TabsContent value="evolution">
          <EvolutionTab
            employeeId={employee.dbId}
            feedbackStats={feedbackStats}
            patterns={patterns}
            evolutionData={evolutionData}
            attributions={attributions}
          />
        </TabsContent>

        {/* Version History Tab */}
        <TabsContent value="versions">
          <VersionHistory employeeId={employee.dbId} versions={configVersions} />
        </TabsContent>

        {/* Scenarios Tab removed 2026-04-20 — employee_scenarios 已由
             workflow_templates 统一管理，请访问 /workflows 或 /missions 新建任务 */}
      </Tabs>

      <SkillBrowserDialog
        open={skillBrowserOpen}
        onOpenChange={setSkillBrowserOpen}
        employeeDbId={employee.dbId}
        availableSkills={availableSkills}
        recommendations={recommendations}
      />

      <SkillTestDialog
        open={skillTestOpen}
        onOpenChange={setSkillTestOpen}
        skills={employee.skills}
      />

      <KBBrowserDialog
        open={kbBrowserOpen}
        onOpenChange={setKbBrowserOpen}
        employeeDbId={employee.dbId}
        availableKBs={availableKBs}
      />

      <LearningNoteDialog
        open={learningNoteOpen}
        onOpenChange={setLearningNoteOpen}
        employeeId={employee.dbId}
      />

      {!employee.isPreset && (
        <EditProfileDialog
          open={editProfileOpen}
          onOpenChange={setEditProfileOpen}
          employeeDbId={employee.dbId}
          defaultValues={{
            name: employee.name,
            nickname: employee.nickname,
            title: employee.title,
            motto: employee.motto,
          }}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EditProfileDialog — 编辑员工基本信息                                */
/* ------------------------------------------------------------------ */

function EditProfileDialog({
  open,
  onOpenChange,
  employeeDbId,
  defaultValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeDbId: string;
  defaultValues: { name: string; nickname: string; title: string; motto: string };
  onSaved: () => void;
}) {
  const [name, setName] = useState(defaultValues.name);
  const [nickname, setNickname] = useState(defaultValues.nickname);
  const [title, setTitle] = useState(defaultValues.title);
  const [motto, setMotto] = useState(defaultValues.motto);
  const [saving, setSaving] = useState(false);

  // 当 dialog 打开时重置为最新默认值
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName(defaultValues.name);
      setNickname(defaultValues.nickname);
      setTitle(defaultValues.title);
      setMotto(defaultValues.motto);
    }
    onOpenChange(v);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEmployeeProfile(employeeDbId, { name, nickname, title, motto });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>编辑员工信息</DialogTitle>
          <DialogDescription>修改员工的基本信息，保存后立即生效。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name" className="text-xs">名称</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm border-none bg-white/60 dark:bg-white/5"
              placeholder="员工名称"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-nickname" className="text-xs">昵称</Label>
            <Input
              id="edit-nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="h-8 text-sm border-none bg-white/60 dark:bg-white/5"
              placeholder="员工昵称"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-title" className="text-xs">职位</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm border-none bg-white/60 dark:bg-white/5"
              placeholder="职位头衔"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-motto" className="text-xs">座右铭</Label>
            <Input
              id="edit-motto"
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              className="h-8 text-sm border-none bg-white/60 dark:bg-white/5"
              placeholder="座右铭"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={handleSave}
            disabled={saving || !name.trim() || !nickname.trim()}
          >
            {saving ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <Save size={14} className="mr-1" />
            )}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// EmployeeWorkflowsSection
// ============================================================================
// Renders workflow_templates bound to this employee as clickable cards.
// Each card triggers `startMission` with `workflowTemplateId` dual-write and
// navigates to the created mission. 场景 = 工作流 — these ARE the employee's
// daily-capability scenarios (不是"选文章再挑模板"的 picker).

const WORKFLOWS_COLLAPSED_COUNT = 12;

function EmployeeWorkflowsSection({
  workflows,
  employeeNickname,
  canManage = false,
}: {
  workflows: WorkflowTemplateRow[];
  employeeNickname: string;
  canManage?: boolean;
}) {
  const [launching, setLaunching] = useState<WorkflowTemplateRow | null>(null);
  const [expanded, setExpanded] = useState(false);

  const resolveIcon = (iconName: string | null | undefined): LucideIcon => {
    if (!iconName) return FileTextIcon;
    const maybe = (LucideIcons as unknown as Record<string, LucideIcon>)[iconName];
    return maybe ?? FileTextIcon;
  };

  const hasMore = workflows.length > WORKFLOWS_COLLAPSED_COUNT;
  const visibleWorkflows = expanded || !hasMore
    ? workflows
    : workflows.slice(0, WORKFLOWS_COLLAPSED_COUNT);

  return (
    <>
    <GlassCard className="mt-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            日常工作流
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {employeeNickname}已固化的 {workflows.length} 个场景能力 — 点击立即启动
          </p>
        </div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer"
          >
            {expanded ? "收起" : `展开全部 (${workflows.length})`}
            <LucideIcons.ChevronDown
              size={14}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {visibleWorkflows.map((wf) => {
          const Icon = resolveIcon(wf.icon);
          return (
            <div
              key={wf.id}
              role="button"
              tabIndex={0}
              onClick={() => setLaunching(wf)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setLaunching(wf);
                }
              }}
              className="relative flex items-start gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer text-left group"
            >
              <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20 flex items-center justify-center group-hover:from-indigo-500/20 group-hover:to-violet-500/20 transition-colors">
                <Icon
                  size={18}
                  className="text-indigo-600 dark:text-indigo-400"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                  {wf.name}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                  {wf.description ?? "—"}
                </p>
              </div>
              {canManage && (
                <div
                  className="absolute right-1 top-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <WorkflowCardMenu templateId={wf.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
    {launching && (
      <WorkflowLaunchDialog
        template={launching}
        open={!!launching}
        onOpenChange={(o) => !o && setLaunching(null)}
      />
    )}
    </>
  );
}
