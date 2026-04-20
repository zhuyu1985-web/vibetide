"use client";

import * as React from "react";
import { Cpu, Check, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Available models (single source of truth)
// ---------------------------------------------------------------------------
// "huasheng" 是华栖云自研「华生」大模型，目前仅占位，后续对接。
export interface ModelOption {
  id: string;
  label: string;
  description: string;
  /** 标记为华栖云自研模型，用于 UI 徽章。*/
  vendor?: "huasheng" | "deepseek" | "zhipu" | "openai" | "anthropic" | "auto";
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "auto",
    label: "智能路由",
    description: "自动选择最适合的模型",
    vendor: "auto",
  },
  {
    id: "huasheng",
    label: "华生",
    description: "华栖云自研多模态大模型",
    vendor: "huasheng",
  },
  {
    id: "deepseek-chat",
    label: "DeepSeek",
    description: "通用对话 · 高性价比",
    vendor: "deepseek",
  },
  {
    id: "glm-5",
    label: "GLM-5",
    description: "智谱最新模型",
    vendor: "zhipu",
  },
  {
    id: "glm-4-flash",
    label: "GLM-4 Flash",
    description: "快速响应",
    vendor: "zhipu",
  },
];

export const DEFAULT_MODEL_ID = "auto";

export function getModelById(id: string | undefined): ModelOption {
  return (
    AVAILABLE_MODELS.find((m) => m.id === id) ?? AVAILABLE_MODELS[0]
  );
}

// ---------------------------------------------------------------------------
// ModelSwitcher
// ---------------------------------------------------------------------------

interface ModelSwitcherProps {
  value: string;
  onChange: (id: string) => void;
  /** 紧凑模式：仅显示图标 + label，去掉多余 padding。 */
  size?: "sm" | "md";
  /** 可选 className，叠加到触发按钮上。 */
  className?: string;
  align?: "start" | "center" | "end";
}

export function ModelSwitcher({
  value,
  onChange,
  size = "md",
  className,
  align = "start",
}: ModelSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const active = getModelById(value);
  const isHuasheng = active.vendor === "huasheng";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="切换模型"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border-0 bg-transparent transition-colors cursor-pointer",
            "text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08]",
            size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs",
            className,
          )}
        >
          {isHuasheng ? (
            <Sparkles
              className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", "text-sky-500")}
            />
          ) : (
            <Cpu className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
          )}
          <span className="font-medium">{active.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} sideOffset={8} className="w-56 p-1.5">
        <div className="space-y-0.5">
          {AVAILABLE_MODELS.map((m) => {
            const selected = m.id === value;
            const vendorBadge = m.vendor === "huasheng" ? "自研" : null;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors border-0 bg-transparent cursor-pointer text-left",
                  selected
                    ? "bg-black/[0.05] dark:bg-white/[0.08] text-foreground"
                    : "text-muted-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
                )}
              >
                <div className="flex flex-col items-start min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {m.label}
                    </span>
                    {vendorBadge && (
                      <span className="px-1.5 py-[1px] rounded text-[9px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        {vendorBadge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {m.description}
                  </span>
                </div>
                {selected && (
                  <Check className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
