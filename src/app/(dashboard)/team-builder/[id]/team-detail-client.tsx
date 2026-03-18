"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { AddMemberDialog } from "@/components/shared/add-member-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WORKFLOW_STEPS } from "@/lib/constants";
import {
  Users,
  UserMinus,
  UserPlus,
  Save,
  Loader2,
  Calendar,
  Settings,
} from "lucide-react";
import { removeTeamMember, updateTeamRules } from "@/app/actions/teams";
import type { TeamWithMembers, AIEmployee } from "@/lib/types";
import type { EmployeeId } from "@/lib/constants";

const scenarioLabels: Record<string, string> = {
  breaking_news: "新闻快讯",
  deep_report: "深度报道",
  social_media: "新媒体运营",
  custom: "自定义团队",
};

interface TeamDetailClientProps {
  team: TeamWithMembers;
  allEmployees: AIEmployee[];
}

export function TeamDetailClient({
  team,
  allEmployees,
}: TeamDetailClientProps) {
  const router = useRouter();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rules, setRules] = useState(team.rules);
  const [newTopic, setNewTopic] = useState("");

  const aiMembers = team.memberDetails.filter((m) => m.memberType === "ai");
  const humanMembers = team.memberDetails.filter(
    (m) => m.memberType === "human"
  );

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await removeTeamMember(memberId);
      router.refresh();
    } catch (err) {
      console.error("Failed to remove member:", err);
    } finally {
      setRemovingId(null);
    }
  };

  const handleSaveRules = async () => {
    setRulesSaving(true);
    try {
      await updateTeamRules(team.id, rules);
      router.refresh();
    } catch (err) {
      console.error("Failed to save rules:", err);
    } finally {
      setRulesSaving(false);
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto">
      <PageHeader
        title={team.name}
        description={`${scenarioLabels[team.scenario] || team.scenario} 场景团队`}
      />

      {/* Team Info */}
      <GlassCard variant="blue" className="mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {aiMembers.length} AI + {humanMembers.length} 人类
            </span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {scenarioLabels[team.scenario] || team.scenario}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 ml-auto">
            <Calendar size={12} />
            创建于 {new Date(team.createdAt).toLocaleDateString("zh-CN")}
          </div>
        </div>
      </GlassCard>

      {/* Members Management */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">团队成员</h2>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => setAddMemberOpen(true)}
          >
            <UserPlus size={14} className="mr-1" />
            添加成员
          </Button>
        </div>

        {/* AI Members */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {aiMembers.map((m) => (
            <GlassCard key={m.id} padding="sm">
              <div className="flex items-center gap-3">
                <EmployeeAvatar
                  employeeId={m.displayName as EmployeeId}
                  size="sm"
                  showStatus
                  status={m.employee?.status}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {m.employee?.nickname || m.displayName}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                    {m.employee?.title || m.teamRole}
                  </p>
                </div>
                <button
                  className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors"
                  onClick={() => handleRemoveMember(m.id)}
                  disabled={removingId === m.id}
                >
                  {removingId === m.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <UserMinus size={14} />
                  )}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Human Members */}
        {humanMembers.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs text-gray-400 dark:text-gray-500 font-medium">人类成员</h3>
            {humanMembers.map((m) => (
              <GlassCard key={m.id} padding="sm">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                    {m.displayName[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {m.displayName}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{m.teamRole}</p>
                  </div>
                  <button
                    className="text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-400 transition-colors"
                    onClick={() => handleRemoveMember(m.id)}
                    disabled={removingId === m.id}
                  >
                    {removingId === m.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <UserMinus size={14} />
                    )}
                  </button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Collaboration Rules */}
      <GlassCard className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">协作规则</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">审批模式</Label>
            <Select
              value={rules.approvalRequired ? "required" : "auto"}
              onValueChange={(v) =>
                setRules({ ...rules, approvalRequired: v === "required" })
              }
            >
              <SelectTrigger className="mt-1 glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="required">需要审批</SelectItem>
                <SelectItem value="auto">自动通过</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {rules.approvalRequired && (
            <div>
              <Label className="text-xs text-gray-500 dark:text-gray-400">审批步骤（勾选需要审批的步骤）</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {WORKFLOW_STEPS.map((ws) => {
                  const isChecked = (rules.approvalSteps || []).includes(ws.key);
                  return (
                    <button
                      key={ws.key}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        isChecked
                          ? "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                          : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-200 dark:hover:border-blue-700/50"
                      }`}
                      onClick={() => {
                        const current = rules.approvalSteps || [];
                        const updated = isChecked
                          ? current.filter((k) => k !== ws.key)
                          : [...current, ws.key];
                        setRules({ ...rules, approvalSteps: updated });
                      }}
                    >
                      {ws.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                未选择时默认仅在「质量审核」步骤审批
              </p>
            </div>
          )}
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">汇报频率</Label>
            <Select
              value={rules.reportFrequency}
              onValueChange={(v) =>
                setRules({ ...rules, reportFrequency: v })
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
          </div>
          <div>
            <Label className="text-xs text-gray-500 dark:text-gray-400">敏感话题标记</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {rules.sensitiveTopics.map((topic, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs pr-1 border-red-200 dark:border-red-700/50 text-red-600 dark:text-red-400"
                >
                  {topic}
                  <button
                    className="ml-1"
                    onClick={() =>
                      setRules({
                        ...rules,
                        sensitiveTopics: rules.sensitiveTopics.filter(
                          (_, j) => j !== i
                        ),
                      })
                    }
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="添加敏感话题..."
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="flex-1 h-8 text-xs glass-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTopic.trim()) {
                    setRules({
                      ...rules,
                      sensitiveTopics: [
                        ...rules.sensitiveTopics,
                        newTopic.trim(),
                      ],
                    });
                    setNewTopic("");
                  }
                }}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              className="text-xs"
              onClick={handleSaveRules}
              disabled={rulesSaving}
            >
              {rulesSaving ? (
                <Loader2 size={12} className="mr-1 animate-spin" />
              ) : (
                <Save size={12} className="mr-1" />
              )}
              保存规则
            </Button>
          </div>
        </div>
      </GlassCard>

      <AddMemberDialog
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        teamId={team.id}
        availableEmployees={allEmployees}
        existingMemberIds={team.members}
      />
    </div>
  );
}
