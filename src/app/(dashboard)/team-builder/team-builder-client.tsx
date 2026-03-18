"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { createTeam } from "@/app/actions/teams";
import {
  Zap,
  BookOpen,
  Share2,
  Settings,
  ArrowRight,
  ArrowLeft,
  Check,
  UserPlus,
  Loader2,
  Users,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import type { AIEmployee, Team } from "@/lib/types";

interface TeamScenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  recommended: readonly string[];
}

const scenarioIcons: Record<string, React.ElementType> = {
  Zap,
  BookOpen,
  Share2,
  Settings,
};

interface TeamBuilderClientProps {
  employees: AIEmployee[];
  scenarios: TeamScenario[];
  existingTeams: Team[];
  organizationId: string;
}

export function TeamBuilderClient({
  employees,
  scenarios,
  existingTeams,
  organizationId,
}: TeamBuilderClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set()
  );
  const [teamName, setTeamName] = useState("");
  const [approvalMode, setApprovalMode] = useState(0); // 0=all, 1=sensitive, 2=auto
  const [reportFrequency, setReportFrequency] = useState(0); // 0=realtime, 1=hourly, 2=4h, 3=daily
  const [sensitiveTopics, setSensitiveTopics] = useState<Set<string>>(
    new Set(["政治", "军事"])
  );
  const [humanMembers, setHumanMembers] = useState<string[]>([]);
  const [newHumanName, setNewHumanName] = useState("");
  const [creating, setCreating] = useState(false);

  const scenario = scenarios.find((s) => s.id === selectedScenario);

  const approvalOptions = ["所有内容需审批", "仅敏感内容审批", "全自动（不推荐）"];
  const frequencyOptions = ["实时", "每小时", "每4小时", "每日"];
  const topicOptions = ["政治", "军事", "法律", "伦理", "灾难", "低俗"];

  const handleScenarioSelect = (id: string) => {
    setSelectedScenario(id);
    const scen = scenarios.find((s) => s.id === id);
    if (scen && scen.recommended.length > 0) {
      setSelectedMembers(new Set(scen.recommended as unknown as string[]));
    }
    setTeamName(scen?.name ? `${scen.name}团队` : "");
  };

  const toggleMember = (id: string) => {
    const next = new Set(selectedMembers);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedMembers(next);
  };

  const toggleTopic = (topic: string) => {
    const next = new Set(sensitiveTopics);
    if (next.has(topic)) {
      next.delete(topic);
    } else {
      next.add(topic);
    }
    setSensitiveTopics(next);
  };

  const handleCreateTeam = async () => {
    setCreating(true);
    try {
      const aiMembersList = Array.from(selectedMembers).map((id) => {
        const emp = employees.find((e) => e.id === id);
        return {
          employeeId: id,
          displayName: id,
          teamRole: emp?.title || id,
        };
      });

      // We need the DB IDs for AI members, but we only have slugs here.
      // The createTeam action expects aiEmployeeId (UUID), but the displayName
      // field stores the slug. Let's pass the slug as displayName and handle in action.
      await createTeam({
        organizationId,
        name: teamName || `${scenario?.name || "自定义"}团队`,
        scenario: selectedScenario || "custom",
        rules: {
          approvalRequired: approvalMode !== 2,
          reportFrequency: frequencyOptions[reportFrequency],
          sensitiveTopics: Array.from(sensitiveTopics),
        },
        aiMembers: aiMembersList,
        humanMembers: humanMembers.map((name) => ({
          displayName: name,
          teamRole: name,
        })),
      });

      router.push("/team-hub");
    } catch (err) {
      console.error("Failed to create team:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto">
      <PageHeader
        title="团队组建"
        description="3步快速组建你的AI智能员工团队"
      />

      {/* Existing Teams */}
      {existingTeams.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">已有团队</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {existingTeams.map((team) => (
              <Link key={team.id} href={`/team-builder/${team.id}`}>
                <GlassCard variant="interactive" padding="sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-blue-500" />
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {team.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1">
                      {team.members.slice(0, 4).map((id) => (
                        <EmployeeAvatar
                          key={id}
                          employeeId={id}
                          size="xs"
                        />
                      ))}
                      {team.members.length > 4 && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">
                          +{team.members.length - 4}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
                      {team.humanMembers.length > 0 &&
                        `${team.humanMembers.length} 人类`}
                    </span>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {["选择场景", "确认成员", "设置规则"].map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i === step
                  ? "bg-blue-500 text-white"
                  : i < step
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
              }`}
            >
              {i < step ? <Check size={16} /> : i + 1}
            </div>
            <span
              className={`text-sm ${
                i === step ? "font-medium text-gray-800 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {label}
            </span>
            {i < 2 && <ArrowRight size={16} className="text-gray-300 dark:text-gray-600 ml-2" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Scenario */}
      {step === 0 && (
        <div className="grid grid-cols-2 gap-4">
          {scenarios.map((scen) => {
            const Icon = scenarioIcons[scen.icon] || Settings;
            const isSelected = selectedScenario === scen.id;
            return (
              <GlassCard
                key={scen.id}
                variant="interactive"
                className={isSelected ? "ring-2 ring-blue-400" : ""}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => handleScenarioSelect(scen.id)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                      <Icon size={20} className="text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
                        {scen.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {scen.description}
                      </p>
                    </div>
                  </div>
                  {scen.recommended.length > 0 && (
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-1">
                        推荐成员：
                      </span>
                      {scen.recommended.map((empId) => (
                        <EmployeeAvatar
                          key={empId}
                          employeeId={empId as EmployeeId}
                          size="xs"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Step 2: Confirm Members */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Team Name */}
          <GlassCard padding="sm">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-400 shrink-0">团队名称</span>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="输入团队名称..."
                className="flex-1 h-8 text-sm glass-input"
              />
            </div>
          </GlassCard>

          {scenario && scenario.recommended.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                基于「{scenario.name}」场景，推荐以下成员（可调整）：
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {employees.map((emp) => {
              const isSelected = selectedMembers.has(emp.id);
              const isRecommended =
                scenario && scenario.recommended.includes(emp.id);
              return (
                <GlassCard
                  key={emp.id}
                  variant="interactive"
                  padding="sm"
                  className={isSelected ? "ring-2 ring-blue-400" : ""}
                >
                  <div
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => toggleMember(emp.id)}
                  >
                    <Checkbox checked={isSelected} />
                    <EmployeeAvatar employeeId={emp.id} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                          {emp.nickname}
                        </span>
                        {isRecommended && (
                          <Badge className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1 py-0">
                            推荐
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">{emp.title}</p>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>

          {/* Human members */}
          <GlassCard padding="sm">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus size={16} className="text-gray-400 dark:text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">人类成员</span>
            </div>
            {humanMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {humanMembers.map((name, i) => (
                  <Badge key={i} variant="secondary" className="text-xs pr-1">
                    {name}
                    <button
                      className="ml-1 hover:text-red-500"
                      onClick={() =>
                        setHumanMembers(humanMembers.filter((_, j) => j !== i))
                      }
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="输入姓名添加..."
                value={newHumanName}
                onChange={(e) => setNewHumanName(e.target.value)}
                className="flex-1 h-8 text-xs glass-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newHumanName.trim()) {
                    setHumanMembers([...humanMembers, newHumanName.trim()]);
                    setNewHumanName("");
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => {
                  if (newHumanName.trim()) {
                    setHumanMembers([...humanMembers, newHumanName.trim()]);
                    setNewHumanName("");
                  }
                }}
              >
                添加
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Step 3: Set Rules */}
      {step === 2 && (
        <div className="space-y-4">
          <GlassCard>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              协作规则配置
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  审批流程
                </label>
                <div className="flex gap-2">
                  {approvalOptions.map((option, i) => (
                    <Button
                      key={i}
                      variant={approvalMode === i ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setApprovalMode(i)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  汇报频率
                </label>
                <div className="flex gap-2">
                  {frequencyOptions.map((option, i) => (
                    <Button
                      key={i}
                      variant={reportFrequency === i ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      onClick={() => setReportFrequency(i)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  敏感话题标记
                </label>
                <div className="flex flex-wrap gap-2">
                  {topicOptions.map((topic) => (
                    <Badge
                      key={topic}
                      variant={
                        sensitiveTopics.has(topic) ? "default" : "outline"
                      }
                      className={`text-xs cursor-pointer transition-colors ${
                        sensitiveTopics.has(topic)
                          ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/50 hover:bg-red-200 dark:hover:bg-red-900/50"
                          : "hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-200 dark:hover:border-red-700/50 hover:text-red-600 dark:hover:text-red-400"
                      }`}
                      onClick={() => toggleTopic(topic)}
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Team Preview */}
          <GlassCard variant="blue">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
              团队预览
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {teamName || `${scenario?.name || "自定义"}团队`}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from(selectedMembers).map((id) => (
                <div
                  key={id}
                  className="flex items-center gap-1.5 bg-white/60 dark:bg-gray-900/60 px-2 py-1 rounded-lg"
                >
                  <EmployeeAvatar employeeId={id as EmployeeId} size="xs" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {EMPLOYEE_META[id as EmployeeId]?.nickname || id}
                  </span>
                </div>
              ))}
              {humanMembers.map((name, i) => (
                <div
                  key={`human-${i}`}
                  className="flex items-center gap-1.5 bg-white/60 dark:bg-gray-900/60 px-2 py-1 rounded-lg"
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[8px] font-bold">
                    {name[0]}
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {name}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft size={16} className="mr-1" />
          上一步
        </Button>
        {step < 2 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={step === 0 && !selectedScenario}
          >
            下一步
            <ArrowRight size={16} className="ml-1" />
          </Button>
        ) : (
          <Button onClick={handleCreateTeam} disabled={creating}>
            {creating ? (
              <Loader2 size={16} className="mr-1 animate-spin" />
            ) : (
              <Check size={16} className="mr-1" />
            )}
            创建团队
          </Button>
        )}
      </div>
    </div>
  );
}
