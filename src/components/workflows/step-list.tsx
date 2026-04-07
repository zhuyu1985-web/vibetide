"use client";

import type { WorkflowStepDef } from "@/db/schema/workflows";
import {
  MoreVertical,
  Plus,
  Pencil,
  ArrowUp,
  ArrowDown,
  Trash2,
  Cog,
  Telescope,
  Globe,
  Newspaper,
  Ear,
  Search,
  BarChart3,
  Users,
  Target,
  PenTool,
  Heading,
  FileStack,
  BookOpen,
  Wand2,
  Languages,
  Lightbulb,
  Film,
  Image,
  Layout,
  Mic,
  CheckSquare,
  Shield,
  ListChecks,
  Share2,
  FolderSearch,
  Library,
  Award,
  TrendingUp,
  Flame,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepListProps {
  steps: WorkflowStepDef[];
  onEdit: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onMoveUp: (stepId: string) => void;
  onMoveDown: (stepId: string) => void;
  onAddStep: () => void;
}

// ---------------------------------------------------------------------------
// Skill icon/color registry
// ---------------------------------------------------------------------------

const SKILL_ICON_MAP: Record<string, LucideIcon> = {
  trend_monitor: Telescope,
  news_aggregation: Newspaper,
  social_listening: Ear,
  web_search: Globe,
  topic_extraction: Search,
  audience_analysis: Users,
  competitor_analysis: Target,
  sentiment_analysis: BarChart3,
  heat_scoring: Flame,
  data_report: TrendingUp,
  content_generate: PenTool,
  headline_generate: Heading,
  summary_generate: FileStack,
  script_generate: BookOpen,
  style_rewrite: Wand2,
  translation: Languages,
  angle_design: Lightbulb,
  video_edit_plan: Film,
  thumbnail_generate: Image,
  layout_design: Layout,
  audio_plan: Mic,
  quality_review: CheckSquare,
  compliance_check: Shield,
  fact_check: ListChecks,
  publish_strategy: Share2,
  task_planning: ListChecks,
  knowledge_retrieval: FolderSearch,
  media_search: Library,
  case_reference: Award,
};

const CATEGORY_COLORS: Record<string, { color: string; bgColor: string }> = {
  perception: { color: "#f59e0b", bgColor: "rgba(245,158,11,0.12)" },
  analysis: { color: "#8b5cf6", bgColor: "rgba(139,92,246,0.12)" },
  generation: { color: "#3b82f6", bgColor: "rgba(59,130,246,0.12)" },
  production: { color: "#ef4444", bgColor: "rgba(239,68,68,0.12)" },
  management: { color: "#6366f1", bgColor: "rgba(99,102,241,0.12)" },
  knowledge: { color: "#14b8a6", bgColor: "rgba(20,184,166,0.12)" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStepVisuals(step: WorkflowStepDef) {
  const skillSlug = step.config?.skillSlug;
  const category = step.config?.skillCategory ?? "";
  const icon = (skillSlug && SKILL_ICON_MAP[skillSlug]) || Cog;
  const colors = CATEGORY_COLORS[category] ?? { color: "#6b7280", bgColor: "rgba(107,114,128,0.12)" };
  const label = step.config?.skillName ?? (step.type === "output" ? "输出动作" : "未分配");
  return { icon, colors, label };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepList({
  steps,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddStep,
}: StepListProps) {
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col items-center w-full">
      {sortedSteps.map((step, idx) => {
        const { icon: StepIcon, colors, label } = getStepVisuals(step);
        const isFirst = idx === 0;
        const isLast = idx === sortedSteps.length - 1;

        return (
          <div key={step.id} className="flex flex-col items-center w-full">
            {/* Connector line between steps */}
            {idx > 0 && (
              <div className="h-6 w-px bg-border" />
            )}

            {/* Step card */}
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm w-full flex items-center gap-3">
              {/* Step number */}
              <div
                className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold shrink-0"
                style={{
                  backgroundColor: colors.bgColor,
                  color: colors.color,
                }}
              >
                {idx + 1}
              </div>

              {/* Skill icon + info */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{
                    backgroundColor: colors.bgColor,
                  }}
                >
                  <StepIcon
                    className="w-4 h-4"
                    style={{ color: colors.color }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {label}
                  </p>
                </div>
              </div>

              {/* Three-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg border-0 bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(step.id)}>
                    <Pencil className="w-4 h-4" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onMoveUp(step.id)}
                    disabled={isFirst}
                  >
                    <ArrowUp className="w-4 h-4" />
                    上移
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onMoveDown(step.id)}
                    disabled={isLast}
                  >
                    <ArrowDown className="w-4 h-4" />
                    下移
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(step.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}

      {/* Connector to add button */}
      {sortedSteps.length > 0 && (
        <div className="h-6 w-px bg-border" />
      )}

      {/* Add step button */}
      <button
        onClick={onAddStep}
        className="w-full rounded-xl border border-dashed border-border bg-transparent p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        添加步骤
      </button>
    </div>
  );
}
