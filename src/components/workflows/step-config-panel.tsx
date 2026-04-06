"use client";

import { useState, useEffect } from "react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
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

const EMPLOYEE_SLUGS: EmployeeId[] = [
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
];

const STEP_TYPES = [
  { value: "employee" as const, label: "AI 员工" },
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
  const [type, setType] = useState<"employee" | "tool" | "output">("employee");
  const [employeeSlug, setEmployeeSlug] = useState<string>("");
  const [outputAction, setOutputAction] = useState<string>("");

  // Sync local state when the step prop changes
  useEffect(() => {
    if (step) {
      setName(step.name);
      setType(step.type);
      setEmployeeSlug(step.config?.employeeSlug ?? step.employeeSlug ?? "");
      setOutputAction(step.config?.outputAction ?? "");
    }
  }, [step]);

  function handleSave() {
    if (!step) return;

    const updated: WorkflowStepDef = {
      ...step,
      name,
      type,
      config: {
        ...step.config,
        parameters: step.config?.parameters ?? {},
        employeeSlug: type === "employee" ? employeeSlug : undefined,
        outputAction: type === "output" ? outputAction : undefined,
      },
    };

    // Also update the top-level backward-compat field
    if (type === "employee") {
      updated.employeeSlug = employeeSlug;
    }

    onSave(updated);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>配置步骤</SheetTitle>
          <SheetDescription>修改步骤名称、类型和执行角色</SheetDescription>
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
                setType(v as "employee" | "tool" | "output")
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

          {/* Employee selector (visible when type = employee) */}
          {type === "employee" && (
            <div className="flex flex-col gap-2">
              <Label>执行员工</Label>
              <Select value={employeeSlug} onValueChange={setEmployeeSlug}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择 AI 员工" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_SLUGS.map((slug) => {
                    const meta = EMPLOYEE_META[slug];
                    const Icon = meta.icon;
                    return (
                      <SelectItem key={slug} value={slug}>
                        <span className="flex items-center gap-2">
                          <span
                            className="flex items-center justify-center w-5 h-5 rounded"
                            style={{ backgroundColor: meta.bgColor }}
                          >
                            <Icon
                              className="w-3 h-3"
                              style={{ color: meta.color }}
                            />
                          </span>
                          {meta.nickname} · {meta.title}
                        </span>
                      </SelectItem>
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
