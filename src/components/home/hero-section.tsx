"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Paperclip, ArrowUp, ChevronDown, MessageSquare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ScenarioChip {
  id: string;
  name: string;
  icon?: string;
}

interface HeroSectionProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  isRecording: boolean;
  onVoiceToggle: () => void;
  disabled?: boolean;
  employeeScenarios?: ScenarioChip[];
  onScenarioChipClick?: (scenario: ScenarioChip) => void;
}

const MODEL_OPTIONS = [
  { value: "auto", label: "自动选择" },
  { value: "deepseek-chat", label: "DeepSeek" },
  { value: "glm-5", label: "GLM-5" },
  { value: "glm-4-flash", label: "GLM-4-Flash" },
];

export function HeroSection({
  inputValue,
  onInputChange,
  onSubmit,
  selectedModel,
  onModelChange,
  isRecording,
  onVoiceToggle,
  disabled = false,
  employeeScenarios = [],
  onScenarioChipClick,
}: HeroSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea up to 160px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  // Close model dropdown on outside click
  useEffect(() => {
    if (!modelOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (inputValue.trim() && !disabled) {
          onSubmit();
        }
      }
    },
    [inputValue, disabled, onSubmit]
  );

  const selectedModelLabel =
    MODEL_OPTIONS.find((m) => m.value === selectedModel)?.label ?? "自动选择";

  const canSubmit = inputValue.trim().length > 0 && !disabled;

  return (
    <div className="flex flex-col items-center gap-6 pt-4 pb-4">
      {/* Status badge */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            超级个体已就绪 · 8 位专家待命
          </span>
        </div>
      </motion.div>

      {/* Title */}
      <motion.div
        className="flex flex-col items-center gap-2 text-center"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          你的智媒工作空间
        </h1>
        <p className="text-base text-muted-foreground">
          与 AI 团队协作，高效完成内容生产
        </p>
      </motion.div>

      {/* Input box — with animated border on hover */}
      <motion.div
        className="w-full max-w-3xl mx-auto"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.16, ease: "easeOut" }}
      >
        <div
          className="input-box-wrapper relative rounded-2xl p-[1px]"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Animated border — conic gradient that rotates on hover */}
          <div
            className={cn(
              "input-box-border-glow absolute inset-0 rounded-2xl transition-opacity duration-500",
              hovered ? "opacity-100" : "opacity-0"
            )}
          />
          {/* Static border when not hovered */}
          <div
            className={cn(
              "absolute inset-0 rounded-2xl border border-border transition-opacity duration-500",
              hovered ? "opacity-0" : "opacity-100"
            )}
          />

          {/* Inner content */}
          <div
            className={cn(
              "relative rounded-2xl bg-background backdrop-blur-xl",
              "shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
              "transition-shadow duration-300",
              hovered && "shadow-[0_4px_32px_rgba(99,102,241,0.12)]"
            )}
          >
            {/* Textarea */}
            <div className="px-5 pt-5 pb-3">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder="有什么想法？告诉 AI 团队…"
                rows={2}
                className={cn(
                  "w-full resize-none bg-transparent outline-none",
                  "text-base text-foreground placeholder:text-muted-foreground/50",
                  "leading-relaxed min-h-[48px]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                style={{ maxHeight: "160px", overflowY: "auto" }}
              />
            </div>

            {/* Employee scenario chips (inside input box) */}
            {employeeScenarios.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-5 pb-3">
                {employeeScenarios.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => onScenarioChipClick?.(sc)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px]
                      bg-accent/60 hover:bg-accent text-muted-foreground hover:text-foreground
                      transition-all duration-150"
                  >
                    {sc.icon && <span className="text-xs">{sc.icon}</span>}
                    {sc.name}
                  </button>
                ))}
              </div>
            )}

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 pb-4 pt-1">
              {/* Left: voice + attachment + model selector */}
              <div className="flex items-center gap-1">
                <button
                  onClick={onVoiceToggle}
                  disabled={disabled}
                  className={cn(
                    "p-2 rounded-xl transition-all duration-200 border-0",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    isRecording
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  title={isRecording ? "停止录音" : "语音输入"}
                >
                  <Mic size={18} />
                </button>

                <button
                  disabled={disabled}
                  className={cn(
                    "p-2 rounded-xl transition-all duration-200 border-0",
                    "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                  title="添加附件"
                >
                  <Paperclip size={18} />
                </button>

                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setModelOpen((v) => !v)}
                    disabled={disabled}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all duration-200 border-0",
                      "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      modelOpen && "bg-accent/50 text-foreground"
                    )}
                  >
                    <span className="text-xs font-medium">{selectedModelLabel}</span>
                    <ChevronDown
                      size={13}
                      className={cn(
                        "transition-transform duration-200",
                        modelOpen && "rotate-180"
                      )}
                    />
                  </button>

                  {modelOpen && (
                    <div
                      className={cn(
                        "absolute bottom-full left-0 mb-1.5 z-50",
                        "w-36 rounded-xl py-1",
                        "bg-popover backdrop-blur-xl",
                        "shadow-[0_8px_32px_rgba(0,0,0,0.2),0_2px_8px_rgba(0,0,0,0.1)]",
                        "border border-border",
                        "animate-in fade-in zoom-in-95 duration-150"
                      )}
                    >
                      {MODEL_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            onModelChange(opt.value);
                            setModelOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs transition-colors duration-150 border-0",
                            opt.value === selectedModel
                              ? "text-indigo-600 dark:text-indigo-300 bg-indigo-500/10"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: send button */}
              <button
                onClick={() => {
                  if (canSubmit) onSubmit();
                }}
                disabled={!canSubmit}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 border-0",
                  canSubmit
                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_2px_12px_rgba(99,102,241,0.4)] hover:shadow-[0_2px_16px_rgba(99,102,241,0.55)] hover:scale-105 cursor-pointer"
                    : "bg-muted text-muted-foreground/40 cursor-not-allowed"
                )}
                title="发送 (Enter)"
              >
                <ArrowUp size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Hint + 对话中心入口 */}
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-[11px] text-muted-foreground/50">
            按 Enter 发送 · Shift+Enter 换行
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              text-indigo-600 dark:text-indigo-400 bg-indigo-500/8 hover:bg-indigo-500/15
              transition-all duration-200 group"
          >
            <MessageSquare size={13} />
            进入对话中心
            <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </motion.div>

    </div>
  );
}
