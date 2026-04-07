"use client";

import { useState, useEffect } from "react";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderOpen, Radio, FileText, Bell } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepConfigPanelProps {
  step: WorkflowStepDef | null;
  open: boolean;
  onClose: () => void;
  onSave: (step: WorkflowStepDef) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTPUT_ACTIONS = [
  { id: "save_to_assets", label: "保存到媒资库", icon: FolderOpen },
  { id: "publish", label: "发布到渠道", icon: Radio },
  { id: "generate_report", label: "生成报告", icon: FileText },
  { id: "send_notification", label: "发送通知", icon: Bell },
] as const;

interface SkillOption {
  slug: string;
  name: string;
  category: string;
}

const SKILL_OPTIONS: SkillOption[] = [
  // perception
  { slug: "trend_monitor", name: "趋势监控", category: "perception" },
  { slug: "news_aggregation", name: "新闻聚合", category: "perception" },
  { slug: "social_listening", name: "社交聆听", category: "perception" },
  { slug: "web_search", name: "网络搜索", category: "perception" },
  // analysis
  { slug: "topic_extraction", name: "选题提取", category: "analysis" },
  { slug: "audience_analysis", name: "受众分析", category: "analysis" },
  { slug: "competitor_analysis", name: "竞品分析", category: "analysis" },
  { slug: "sentiment_analysis", name: "情感分析", category: "analysis" },
  { slug: "heat_scoring", name: "热度评分", category: "analysis" },
  { slug: "data_report", name: "数据报告", category: "analysis" },
  // generation
  { slug: "content_generate", name: "内容生成", category: "generation" },
  { slug: "headline_generate", name: "标题生成", category: "generation" },
  { slug: "summary_generate", name: "摘要生成", category: "generation" },
  { slug: "script_generate", name: "脚本生成", category: "generation" },
  { slug: "style_rewrite", name: "风格改写", category: "generation" },
  { slug: "translation", name: "翻译", category: "generation" },
  { slug: "angle_design", name: "角度设计", category: "generation" },
  // production
  { slug: "video_edit_plan", name: "视频剪辑方案", category: "production" },
  { slug: "thumbnail_generate", name: "缩略图生成", category: "production" },
  { slug: "layout_design", name: "版面设计", category: "production" },
  { slug: "audio_plan", name: "音频方案", category: "production" },
  // management
  { slug: "quality_review", name: "质量审核", category: "management" },
  { slug: "compliance_check", name: "合规检查", category: "management" },
  { slug: "fact_check", name: "事实核查", category: "management" },
  { slug: "publish_strategy", name: "发布策略", category: "management" },
  { slug: "task_planning", name: "任务规划", category: "management" },
  // knowledge
  { slug: "knowledge_retrieval", name: "知识检索", category: "knowledge" },
  { slug: "media_search", name: "媒资搜索", category: "knowledge" },
  { slug: "case_reference", name: "案例参考", category: "knowledge" },
];

const CATEGORY_LABELS: Record<string, string> = {
  perception: "感知",
  analysis: "分析",
  generation: "生成",
  production: "制作",
  management: "管理",
  knowledge: "知识",
};

const STEP_TYPES = [
  { value: "skill" as const, label: "技能" },
  { value: "output" as const, label: "输出动作" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepConfigPanel({
  step,
  open,
  onClose,
  onSave,
}: StepConfigPanelProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"skill" | "output">("skill");
  const [skillSlug, setSkillSlug] = useState<string>("");
  const [outputAction, setOutputAction] = useState<string>("");

  // Sync local state when the step prop changes
  useEffect(() => {
    if (step) {
      setName(step.name);
      // Handle backward compat: old "employee" type maps to "skill"
      setType(step.type === "output" ? "output" : "skill");
      setSkillSlug(step.config?.skillSlug ?? "");
      setOutputAction(step.config?.outputAction ?? "");
    }
  }, [step]);

  function handleSave() {
    if (!step) return;

    const selectedSkill = SKILL_OPTIONS.find((s) => s.slug === skillSlug);

    const updated: WorkflowStepDef = {
      ...step,
      name,
      type,
      config: {
        ...step.config,
        parameters: step.config?.parameters ?? {},
        skillSlug: type === "skill" ? skillSlug : undefined,
        skillName: type === "skill" ? selectedSkill?.name : undefined,
        skillCategory: type === "skill" ? selectedSkill?.category : undefined,
        outputAction: type === "output" ? outputAction : undefined,
      },
    };

    onSave(updated);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>配置步骤</SheetTitle>
          <SheetDescription>修改步骤名称、类型和执行技能</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-4 flex-1 overflow-y-auto">
          {/* Step Name */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="step-name">步骤名称</Label>
            <Input
              id="step-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入步骤名称"
            />
          </div>

          {/* Step Type */}
          <div className="flex flex-col gap-2">
            <Label>步骤类型</Label>
            <Select
              value={type}
              onValueChange={(v) =>
                setType(v as "skill" | "output")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                {STEP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Skill selector (visible when type = skill) */}
          {type === "skill" && (
            <div className="flex flex-col gap-2">
              <Label>执行技能</Label>
              <Select value={skillSlug} onValueChange={setSkillSlug}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择技能" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(CATEGORY_LABELS).map((cat) => {
                    const catSkills = SKILL_OPTIONS.filter((s) => s.category === cat);
                    if (catSkills.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                          {CATEGORY_LABELS[cat]}
                        </div>
                        {catSkills.map((skill) => (
                          <SelectItem key={skill.slug} value={skill.slug}>
                            {skill.name}
                          </SelectItem>
                        ))}
                      </div>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Output action selector (visible when type = output) */}
          {type === "output" && (
            <div className="flex flex-col gap-2">
              <Label>输出动作</Label>
              <Select value={outputAction} onValueChange={setOutputAction}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择输出动作" />
                </SelectTrigger>
                <SelectContent>
                  {OUTPUT_ACTIONS.map((action) => {
                    const Icon = action.icon;
                    return (
                      <SelectItem key={action.id} value={action.id}>
                        <span className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          {action.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <SheetFooter>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] text-sm text-muted-foreground border-0 cursor-pointer transition-colors hover:bg-black/[0.08] dark:hover:bg-white/[0.12]"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm border-0 cursor-pointer transition-colors hover:bg-primary/90"
          >
            保存
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
