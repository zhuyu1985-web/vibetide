"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { InputFieldDef } from "@/lib/types";
import { FieldRenderer } from "./workflow-launch-dialog";

interface TestRunInputsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: InputFieldDef[];
  /**
   * Fired after the user fills the form and confirms. Parent should then
   * kick off the test-run with these values so the LLM receives concrete
   * context instead of hallucinating from a bare step name.
   */
  onConfirm: (values: Record<string, unknown>) => void;
}

/**
 * Minimal pre-flight form for "测试运行". Renders every `InputFieldDef` via
 * the shared `FieldRenderer` (same widgets as `WorkflowLaunchDialog`), does
 * a lightweight required-field check on the client, then hands the values
 * back to the caller. Intentionally skips the full Zod validation the
 * real launch does — test runs are meant to be quick and forgiving.
 */
/**
 * Build a per-position initial value array. We key internal state by array
 * INDEX (not `field.name`) because users can save workflows where multiple
 * fields share the same (often empty) `name` — and keying by name collapses
 * them into a single state slot, which makes typing in one field instantly
 * overwrite every other field's value. Indexing by position is bulletproof:
 * each row gets its own slot regardless of what `name` contains.
 */
function buildInitialValuesByIdx(fields: InputFieldDef[]): unknown[] {
  return fields.map((f) => (f.defaultValue !== undefined ? f.defaultValue : undefined));
}

export function TestRunInputsDialog({
  open,
  onOpenChange,
  fields,
  onConfirm,
}: TestRunInputsDialogProps) {
  // Internal state: positional array (see `buildInitialValuesByIdx` for why).
  const [values, setValues] = React.useState<unknown[]>(() =>
    buildInitialValuesByIdx(fields),
  );
  const [errors, setErrors] = React.useState<Record<number, string>>({});

  React.useEffect(() => {
    if (open) {
      setValues(buildInitialValuesByIdx(fields));
      setErrors({});
    }
  }, [open, fields]);

  function handleSubmit() {
    const nextErrors: Record<number, string> = {};
    fields.forEach((f, idx) => {
      if (!f.required) return;
      const v = values[idx];
      const empty =
        v === undefined ||
        v === null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0);
      if (empty) nextErrors[idx] = "必填";
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    // 映射回 name-keyed 字典供下游（LLM prompt 模板 / validateInputs）使用。
    // 若出现重复 name，后面的字段会覆盖前面的 —— 这是数据层约束问题，由编辑器保证 name 唯一。
    const nameKeyed: Record<string, unknown> = {};
    fields.forEach((f, idx) => {
      if (values[idx] !== undefined) nameKeyed[f.name] = values[idx];
    });
    onConfirm(nameKeyed);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>填写测试输入</DialogTitle>
          <DialogDescription>
            为避免模型空转造出无关内容，请先补齐工作流的输入字段再开始测试。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-4 py-1">
          {fields.map((field, idx) => (
            <FieldRenderer
              key={idx}
              field={field}
              value={values[idx]}
              error={errors[idx]}
              onChange={(v) =>
                setValues((prev) => {
                  const next = prev.slice();
                  next[idx] = v;
                  return next;
                })
              }
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>开始测试</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
