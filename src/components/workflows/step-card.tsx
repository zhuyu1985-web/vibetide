"use client";

import type { WorkflowStepDef } from "@/db/schema/workflows";
import {
  MoreVertical,
  Pencil,
  ArrowUp,
  ArrowDown,
  Trash2,
  Loader2,
  Check,
  X,
  Eye,
  BarChart3,
  PenTool,
  Film,
  Shield,
  BookOpen,
  Cog,
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
// Skill Category Config
// ---------------------------------------------------------------------------

const SKILL_CATEGORY_CONFIG: Record<
  string,
  { icon: LucideIcon; color: string; bgColor: string; label: string }
> = {
  perception: {
    icon: Eye,
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.12)",
    label: "感知",
  },
  analysis: {
    icon: BarChart3,
    color: "#8b5cf6",
    bgColor: "rgba(139,92,246,0.12)",
    label: "分析",
  },
  generation: {
    icon: PenTool,
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.12)",
    label: "生成",
  },
  production: {
    icon: Film,
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
    label: "制作",
  },
  management: {
    icon: Shield,
    color: "#6366f1",
    bgColor: "rgba(99,102,241,0.12)",
    label: "管理",
  },
  knowledge: {
    icon: BookOpen,
    color: "#10b981",
    bgColor: "rgba(16,185,129,0.12)",
    label: "知识",
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepCardProps {
  step: WorkflowStepDef;
  index: number;
  selected: boolean;
  status?: "idle" | "pending" | "running" | "completed" | "failed";
  statusMessage?: string;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryConfig(category?: string) {
  if (!category) return null;
  return SKILL_CATEGORY_CONFIG[category] ?? null;
}

function getStatusIcon(status: StepCardProps["status"]) {
  switch (status) {
    case "running":
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    case "completed":
      return <Check className="w-4 h-4 text-green-500" />;
    case "failed":
      return <X className="w-4 h-4 text-red-500" />;
    default:
      return null;
  }
}

function getStatusBorderClass(status: StepCardProps["status"], selected: boolean) {
  if (status === "running") return "border-blue-500";
  if (status === "completed") return "border-green-500";
  if (status === "failed") return "border-red-500";
  if (selected) return "border-blue-500";
  return "border-border";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepCard({
  step,
  index,
  selected,
  status = "idle",
  statusMessage,
  onClick,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: StepCardProps) {
  const catConfig = getCategoryConfig(step.config?.skillCategory);
  const CategoryIcon = catConfig?.icon ?? Cog;
  const statusIcon = getStatusIcon(status);
  const borderClass = getStatusBorderClass(status, selected);

  // Use status icon to replace category icon when running/completed/failed
  const showStatusIcon = status === "running" || status === "completed" || status === "failed";

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Main card */}
      <button
        onClick={onClick}
        className={`flex-1 rounded-xl bg-card border shadow-sm p-4 flex items-center gap-3 transition-colors hover:border-blue-500/50 cursor-pointer ${borderClass} ${status === "pending" ? "opacity-50" : ""}`}
      >
        {/* Left icon */}
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
          style={{
            backgroundColor: showStatusIcon
              ? status === "running"
                ? "rgba(59,130,246,0.12)"
                : status === "completed"
                  ? "rgba(16,185,129,0.12)"
                  : "rgba(239,68,68,0.12)"
              : catConfig?.bgColor ?? "rgba(107,114,128,0.12)",
          }}
        >
          {showStatusIcon ? (
            statusIcon
          ) : (
            <CategoryIcon
              className="w-4 h-4"
              style={{ color: catConfig?.color ?? "#6b7280" }}
            />
          )}
        </div>

        {/* Center label */}
        <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
          步骤 {index + 1}：{step.name}
        </span>

        {/* Three-dot menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.stopPropagation();
              }}
              className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="w-4 h-4" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMoveUp} disabled={isFirst}>
              <ArrowUp className="w-4 h-4" />
              上移
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMoveDown} disabled={isLast}>
              <ArrowDown className="w-4 h-4" />
              下移
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={onDelete}
            >
              <Trash2 className="w-4 h-4" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </button>

      {/* Status message shown to the right of the card */}
      {(status === "running" || status === "completed" || status === "failed") &&
        statusMessage && (
          <span
            className={`shrink-0 text-xs max-w-40 truncate ${
              status === "completed"
                ? "text-green-600 dark:text-green-400"
                : status === "failed"
                  ? "text-red-600 dark:text-red-400"
                  : "text-blue-600 dark:text-blue-400"
            }`}
          >
            {statusMessage}
          </span>
        )}
    </div>
  );
}

export { SKILL_CATEGORY_CONFIG };
