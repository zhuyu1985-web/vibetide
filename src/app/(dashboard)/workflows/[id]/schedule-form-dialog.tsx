"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CronExpressionParser } from "cron-parser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FieldRenderer } from "@/components/workflows/workflow-launch-dialog";
import {
  createWorkflowTemplateSchedule,
  updateWorkflowTemplateSchedule,
} from "@/app/actions/workflow-template-schedules";
import type { ScheduledJob } from "@/db/schema/scheduled-jobs";
import type { WorkflowTemplateRow } from "@/db/types";
import type { InputFieldDef } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: WorkflowTemplateRow;
  editing: ScheduledJob | null;
  onSaved: (saved: ScheduledJob) => void;
}

interface FormState {
  displayName: string;
  description: string;
  cronExpression: string;
  timezone: string;
  payload: Record<string, unknown>;
  enabled: boolean;
}

function buildInitialState(editing: ScheduledJob | null): FormState {
  if (editing) {
    return {
      displayName: editing.displayName,
      description: editing.description ?? "",
      cronExpression: editing.cronExpression,
      timezone: editing.timezone,
      payload: (editing.payload ?? {}) as Record<string, unknown>,
      enabled: editing.enabled,
    };
  }
  return {
    displayName: "",
    description: "",
    cronExpression: "0 9 * * *",
    timezone: "Asia/Shanghai",
    payload: {},
    enabled: true,
  };
}

function formatPreview(d: Date, tz: string): string {
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  workflow,
  editing,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState>(() => buildInitialState(editing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  // 切换 editing 时重置表单
  useEffect(() => {
    if (open) {
      setForm(buildInitialState(editing));
      setErrors({});
    }
  }, [open, editing]);

  const inputFields = useMemo<InputFieldDef[]>(
    () => (workflow.inputFields ?? []) as InputFieldDef[],
    [workflow.inputFields],
  );

  // 浏览器端 cron 预览(失败时显示错误,服务端会再校验一遍)
  const cronPreview = useMemo<
    { ok: true; lines: string[] } | { ok: false; error: string }
  >(() => {
    try {
      const it = CronExpressionParser.parse(form.cronExpression.trim(), {
        tz: form.timezone,
        currentDate: new Date(),
      });
      const lines = [
        formatPreview(it.next().toDate(), form.timezone),
        formatPreview(it.next().toDate(), form.timezone),
        formatPreview(it.next().toDate(), form.timezone),
      ];
      return { ok: true, lines };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "格式错误";
      return { ok: false, error: msg };
    }
  }, [form.cronExpression, form.timezone]);

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updatePayloadField = (fieldKey: string, value: unknown) => {
    setForm((prev) => ({
      ...prev,
      payload: { ...prev.payload, [fieldKey]: value },
    }));
  };

  const handleSubmit = () => {
    setErrors({});
    startTransition(async () => {
      const res = editing
        ? await updateWorkflowTemplateSchedule({
            id: editing.id,
            displayName: form.displayName,
            description: form.description || null,
            cronExpression: form.cronExpression,
            timezone: form.timezone,
            payload: form.payload,
            enabled: form.enabled,
          })
        : await createWorkflowTemplateSchedule({
            workflowTemplateId: workflow.id,
            displayName: form.displayName,
            description: form.description || undefined,
            cronExpression: form.cronExpression,
            timezone: form.timezone,
            payload: form.payload,
            enabled: form.enabled,
          });

      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
      onSaved(res.data);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "编辑定时任务" : "新建定时任务"}
          </DialogTitle>
          <DialogDescription>
            为「{workflow.name}」配置 cron 调度。到点会自动按预设参数启动 mission。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {errors._global ? (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errors._global}
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              名称 <span className="text-red-500">*</span>
            </label>
            <Input
              value={form.displayName}
              onChange={(e) => updateField("displayName", e.target.value)}
              placeholder="如:每日早 9 点抓热点"
            />
            {errors.displayName ? (
              <p className="mt-1 text-xs text-rose-600">{errors.displayName}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">说明</label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={2}
              placeholder="可选,描述这个定时任务的用途"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                cron 表达式 <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.cronExpression}
                onChange={(e) => updateField("cronExpression", e.target.value)}
                placeholder="0 9 * * *"
                className="font-mono"
              />
              {errors.cronExpression ? (
                <p className="mt-1 text-xs text-rose-600">
                  {errors.cronExpression}
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">时区</label>
              <Input
                value={form.timezone}
                onChange={(e) => updateField("timezone", e.target.value)}
                placeholder="Asia/Shanghai"
              />
            </div>
          </div>

          <div className="rounded-md bg-sky-50/60 px-3 py-2">
            <p className="mb-1 text-xs font-medium text-sky-700">
              下次执行预览
            </p>
            {cronPreview.ok ? (
              <ul className="space-y-0.5 text-xs text-gray-700">
                {cronPreview.lines.map((l, i) => (
                  <li key={i} className="font-mono">
                    · {l}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-rose-600">{cronPreview.error}</p>
            )}
          </div>

          {inputFields.length > 0 ? (
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium">默认参数</p>
              <div className="space-y-3">
                {inputFields.map((field) => (
                  <FieldRenderer
                    key={field.name}
                    field={field}
                    value={form.payload[field.name]}
                    onChange={(v) => updatePayloadField(field.name, v)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <label className="inline-flex items-center gap-2 text-sm">
            <Switch
              checked={form.enabled}
              onCheckedChange={(v) => updateField("enabled", v)}
            />
            创建后立即启用
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "保存中…" : editing ? "保存" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
