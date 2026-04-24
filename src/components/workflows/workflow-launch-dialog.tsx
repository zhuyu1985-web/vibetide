"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { DateRange } from "react-day-picker";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DatePicker, DateRangePicker } from "@/components/shared/date-picker";

import { startMissionFromTemplate } from "@/app/actions/workflow-launch";
import type { WorkflowTemplateRow } from "@/db/types";
import type { InputFieldDef, InputFieldOption } from "@/lib/types";
import { normalizeFieldOption } from "@/lib/types";

/**
 * Task 2.2 — Schema-driven launch dialog for `workflow_templates`.
 *
 * Renders all 9 `InputFieldDef` types (text / textarea / url / number /
 * toggle / select / multiselect / date / daterange) using shared design-system
 * primitives. On submit, delegates to `startMissionFromTemplate` (Task 2.1),
 * surfaces per-field errors, and navigates to the new mission on success.
 */

// ─────────────────────── helpers ───────────────────────

function normalizeOptions(
  opts: InputFieldDef["options"],
): { value: string; label: string }[] {
  return (opts ?? []).map((o: InputFieldOption) => normalizeFieldOption(o));
}

export function buildInitialValues(
  fields: InputFieldDef[],
): Record<string, unknown> {
  const init: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) init[f.name] = f.defaultValue;
  }
  return init;
}

/** Convert a yyyy-MM-dd string (or anything `Date.parse` accepts) to a Date. */
function toDate(value: unknown): Date | undefined {
  if (!value || typeof value !== "string") return undefined;
  const t = Date.parse(value);
  return Number.isNaN(t) ? undefined : new Date(t);
}

/** Format a Date as yyyy-MM-dd (matches `validateInputs` date shape). */
function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DateRangeValue {
  start: string;
  end: string;
}

function isDateRangeValue(v: unknown): v is DateRangeValue {
  return (
    typeof v === "object" &&
    v !== null &&
    "start" in v &&
    "end" in v &&
    typeof (v as { start: unknown }).start === "string" &&
    typeof (v as { end: unknown }).end === "string"
  );
}

// ─────────────────────── field renderer ───────────────────────

export interface FieldRendererProps {
  field: InputFieldDef;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}

export function FieldRenderer({ field, value, error, onChange }: FieldRendererProps) {
  const labelNode = (
    <div className="mb-1.5 flex items-baseline gap-1">
      <label className="text-sm font-medium">{field.label}</label>
      {field.required && <span className="text-xs text-red-500">*</span>}
      {field.helpText && (
        <span className="ml-2 text-xs text-muted-foreground">
          {field.helpText}
        </span>
      )}
    </div>
  );

  const errNode = error ? (
    <p className="mt-1 text-xs text-red-600">{error}</p>
  ) : null;

  switch (field.type) {
    case "text":
    case "url":
      return (
        <div>
          {labelNode}
          <Input
            type={field.type === "url" ? "url" : "text"}
            value={(value as string | undefined) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
          {errNode}
        </div>
      );

    case "textarea":
      return (
        <div>
          {labelNode}
          <Textarea
            value={(value as string | undefined) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
          />
          {errNode}
        </div>
      );

    case "number":
      return (
        <div>
          {labelNode}
          <Input
            type="number"
            value={
              typeof value === "number" || typeof value === "string"
                ? value
                : ""
            }
            onChange={(e) => {
              const raw = e.target.value;
              onChange(raw === "" ? "" : Number(raw));
            }}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
          />
          {errNode}
        </div>
      );

    case "toggle":
      return (
        <div>
          {labelNode}
          <label className="inline-flex items-center gap-2">
            <Switch
              checked={Boolean(value)}
              onCheckedChange={(v) => onChange(v)}
            />
            <span className="text-sm text-muted-foreground">
              {field.placeholder ?? "开启"}
            </span>
          </label>
          {errNode}
        </div>
      );

    case "select": {
      const opts = normalizeOptions(field.options);
      return (
        <div>
          {labelNode}
          <Select
            value={(value as string | undefined) ?? ""}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={field.placeholder ?? "请选择"} />
            </SelectTrigger>
            <SelectContent>
              {opts.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errNode}
        </div>
      );
    }

    case "multiselect": {
      // No shared MultiSelect primitive exists — use a toggle-button grid.
      // Buttons use the shared `<Button>` primitive (variant="default" when
      // active, "ghost" otherwise) so they inherit the borderless glass style.
      const opts = normalizeOptions(field.options);
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          {labelNode}
          <div className="flex flex-wrap gap-2">
            {opts.map((o) => {
              const active = selected.includes(o.value);
              return (
                <Button
                  key={o.value}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "ghost"}
                  onClick={() => {
                    const next = active
                      ? selected.filter((v) => v !== o.value)
                      : [...selected, o.value];
                    onChange(next);
                  }}
                >
                  {o.label}
                </Button>
              );
            })}
          </div>
          {errNode}
        </div>
      );
    }

    case "date":
      return (
        <div>
          {labelNode}
          <DatePicker
            value={toDate(value) ?? null}
            onChange={(d) => onChange(d ? formatYmd(d) : null)}
            placeholder={field.placeholder ?? "选择日期"}
          />
          {errNode}
        </div>
      );

    case "daterange": {
      const rangeValue: DateRange | undefined = isDateRangeValue(value)
        ? {
            from: toDate(value.start),
            to: toDate(value.end),
          }
        : undefined;
      return (
        <div>
          {labelNode}
          <DateRangePicker
            value={rangeValue}
            onChange={(r) => {
              if (r?.from && r?.to) {
                onChange({ start: formatYmd(r.from), end: formatYmd(r.to) });
              } else {
                onChange(null);
              }
            }}
            placeholder={field.placeholder ?? "选择日期范围"}
          />
          {errNode}
        </div>
      );
    }

    default:
      return null;
  }
}

// ─────────────────────── dialog ───────────────────────

export interface WorkflowLaunchDialogProps {
  template: WorkflowTemplateRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Build positional initial values. See the long comment in TestRunInputsDialog
 * for why we index state by position — short version: users routinely save
 * workflows where multiple fields share the same `name` (often empty), and
 * name-keyed state makes those fields share a single slot, so typing in one
 * overwrites every other. Positional keying eliminates the problem entirely.
 */
function buildInitialValuesByIdx(fields: InputFieldDef[]): unknown[] {
  return fields.map((f) => (f.defaultValue !== undefined ? f.defaultValue : undefined));
}

export function WorkflowLaunchDialog({
  template,
  open,
  onOpenChange,
}: WorkflowLaunchDialogProps) {
  const router = useRouter();
  const fields: InputFieldDef[] = React.useMemo(
    () => template.inputFields ?? [],
    [template.inputFields],
  );

  // Positional (index-keyed) values — see `buildInitialValuesByIdx` rationale.
  const [values, setValues] = React.useState<unknown[]>(() =>
    buildInitialValuesByIdx(fields),
  );
  // Errors track two shapes: positional (from local validation / per-row from
  // the server mapped by name→first-matching-idx) plus `_global` for banner.
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  // Reset form whenever the dialog opens (or the template switches).
  React.useEffect(() => {
    if (open) {
      setValues(buildInitialValuesByIdx(fields));
      setErrors({});
    }
  }, [open, template.id, fields]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // 映射 idx-keyed → name-keyed，交给后端（validateInputs / promptTemplate 都按 name 找值）。
      const nameKeyed: Record<string, unknown> = {};
      fields.forEach((f, idx) => {
        if (values[idx] !== undefined) nameKeyed[f.name] = values[idx];
      });
      const res = await startMissionFromTemplate(template.id, nameKeyed);
      if (!res.ok) {
        // server 返回 name-keyed errors，直接存；渲染时按 name 查。
        setErrors(res.errors);
        return;
      }
      onOpenChange(false);
      router.push(`/missions/${res.missionId}`);
    } catch (e) {
      setErrors({
        _global: e instanceof Error ? e.message : "启动失败",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          {template.description && (
            <DialogDescription>{template.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              此场景无需填写参数，点击"启动"直接开始。
            </p>
          ) : (
            fields.map((f, idx) => (
              <FieldRenderer
                key={idx}
                field={f}
                value={values[idx]}
                error={errors[f.name]}
                onChange={(v) =>
                  setValues((prev) => {
                    const next = prev.slice();
                    next[idx] = v;
                    return next;
                  })
                }
              />
            ))
          )}
          {errors._global && (
            <p className="text-sm text-red-600">{errors._global}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "启动中…" : "启动"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
