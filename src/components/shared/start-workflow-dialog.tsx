"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { startWorkflow } from "@/app/actions/workflow-engine";
import { WORKFLOW_STEPS } from "@/lib/constants";
import type { Team } from "@/lib/types";
import { Play, Loader2 } from "lucide-react";

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: { key: string; label: string; employeeSlug: string; order: number }[];
}

interface StartWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: Team[];
  templates: WorkflowTemplate[];
  organizationId: string;
}

export function StartWorkflowDialog({
  open,
  onOpenChange,
  teams,
  templates,
  organizationId,
}: StartWorkflowDialogProps) {
  const router = useRouter();
  const [topicTitle, setTopicTitle] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  async function handleStart() {
    if (!topicTitle || !selectedTeamId) return;
    setLoading(true);
    try {
      const steps = selectedTemplate
        ? selectedTemplate.steps.map((s) => ({
            key: s.key,
            label: s.label,
            stepOrder: s.order,
          }))
        : WORKFLOW_STEPS.map((s, i) => ({
            key: s.key,
            label: s.label,
            stepOrder: i + 1,
          }));

      await startWorkflow({
        topicTitle,
        scenario: selectedTeam?.scenario || "custom",
        teamId: selectedTeamId,
        templateId: selectedTemplateId || undefined,
        organizationId,
        steps,
      });

      setTopicTitle("");
      setSelectedTeamId("");
      setSelectedTemplateId("");
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>启动新工作流</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>选题标题</Label>
            <Input
              placeholder="输入选题标题，如「AI手机大战」"
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>选择团队</Label>
            <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="选择执行团队" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>工作流模板（可选）</Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="使用默认8步流程" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-gray-500 dark:text-gray-400">执行步骤预览</Label>
            <div className="flex flex-wrap gap-1.5">
              {(selectedTemplate?.steps || WORKFLOW_STEPS).map((s, i) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200/50 dark:border-blue-700/50"
                >
                  {i + 1}. {s.label}
                </span>
              ))}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleStart}
            disabled={!topicTitle || !selectedTeamId || loading}
          >
            {loading ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Play size={16} className="mr-2" />
            )}
            启动工作流
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
