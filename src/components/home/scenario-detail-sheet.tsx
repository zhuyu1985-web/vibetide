"use client";

import { useState, useEffect } from "react";
import { Play, MessageSquare } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ADVANCED_SCENARIO_CONFIG, EMPLOYEE_META, type AdvancedScenarioKey } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { cn } from "@/lib/utils";

interface ScenarioDetailSheetProps {
  scenarioKey: AdvancedScenarioKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunch: (key: AdvancedScenarioKey, inputs: Record<string, string>) => void;
  onChat: (key: AdvancedScenarioKey) => void;
}

export function ScenarioDetailSheet({
  scenarioKey,
  open,
  onOpenChange,
  onLaunch,
  onChat,
}: ScenarioDetailSheetProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // Reset form when scenario changes
  useEffect(() => {
    setFormValues({});
  }, [scenarioKey]);

  if (!scenarioKey) return null;
  const sc = ADVANCED_SCENARIO_CONFIG[scenarioKey];

  function handleLaunch() {
    if (!scenarioKey) return;
    onLaunch(scenarioKey, formValues);
    setFormValues({});
  }

  function handleChat() {
    if (!scenarioKey) return;
    onChat(scenarioKey);
    setFormValues({});
  }

  function handleFieldChange(name: string, value: string) {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] bg-slate-950 border-l border-white/10 overflow-y-auto flex flex-col gap-0 p-0"
      >
        {/* ── Header ── */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-start gap-3">
            <span className="text-4xl leading-none mt-0.5">{sc.emoji}</span>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-white text-lg font-semibold leading-tight mb-1">
                {sc.label}
              </SheetTitle>
              <p className="text-sm text-white/50 leading-snug">{sc.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-white/30">{sc.teamDescription}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ color: sc.color, backgroundColor: sc.bgColor }}
                >
                  {sc.timeTarget}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Team Section ── */}
          <section>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              协作团队
            </h3>
            <div className="flex items-start gap-4 flex-wrap">
              {sc.teamMembers.map((memberId) => {
                const meta = EMPLOYEE_META[memberId];
                return (
                  <div key={memberId} className="flex flex-col items-center gap-1.5">
                    <EmployeeAvatar employeeId={memberId} size="md" animated />
                    <span className="text-[10px] text-white/50 text-center leading-tight max-w-[56px]">
                      {meta?.title ?? memberId}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Workflow Steps ── */}
          <section>
            <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
              工作流程
            </h3>
            <div className="space-y-0">
              {sc.workflowSteps.map((step, index) => {
                const meta = EMPLOYEE_META[step.employeeSlug];
                const isLast = index === sc.workflowSteps.length - 1;
                return (
                  <div key={index} className="flex gap-3">
                    {/* Step number + connector */}
                    <div className="flex flex-col items-center">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
                        style={{ backgroundColor: meta?.color ?? "#6b7280" }}
                      >
                        {index + 1}
                      </div>
                      {!isLast && (
                        <div className="w-px flex-1 bg-white/10 my-1" style={{ minHeight: 16 }} />
                      )}
                    </div>

                    {/* Step content */}
                    <div className={cn("pb-4 flex-1 min-w-0", isLast && "pb-0")}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-white/90">{step.title}</span>
                        {step.parallel && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.08] text-white/50 font-medium">
                            并行
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/40 mb-1">{meta?.title ?? step.employeeSlug}</div>
                      <div className="text-xs text-white/60 leading-relaxed">{step.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Input Form ── */}
          {sc.inputFields.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
                启动参数
              </h3>
              <div className="space-y-4">
                {sc.inputFields.map((field) => (
                  <div key={field.name}>
                    <label className="block text-sm text-white/70 mb-1.5">
                      {field.label}
                      {field.required && (
                        <span className="text-red-400 ml-1">*</span>
                      )}
                    </label>

                    {field.type === "text" && (
                      <input
                        type="text"
                        value={formValues[field.name] ?? ""}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:bg-white/[0.09] transition-colors duration-150"
                      />
                    )}

                    {field.type === "textarea" && (
                      <textarea
                        value={formValues[field.name] ?? ""}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full bg-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:bg-white/[0.09] transition-colors duration-150 resize-none"
                      />
                    )}

                    {field.type === "select" && field.options && (
                      <select
                        value={formValues[field.name] ?? ""}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        className="w-full bg-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none focus:bg-white/[0.09] transition-colors duration-150 appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-slate-900 text-white/50">
                          请选择…
                        </option>
                        {field.options.map((opt) => (
                          <option key={opt} value={opt} className="bg-slate-900 text-white">
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── Bottom Action Buttons ── */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex gap-3">
          <button
            onClick={handleLaunch}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-opacity duration-150 hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            }}
          >
            <Play size={15} strokeWidth={2.5} />
            一键启动
          </button>
          <button
            onClick={handleChat}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white/80 bg-white/[0.06] cursor-pointer transition-colors duration-150 hover:bg-white/[0.10] hover:text-white"
          >
            <MessageSquare size={15} strokeWidth={2} />
            进入对话
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
