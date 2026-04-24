"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { InputFieldDef, InputFieldOption } from "@/lib/types";
import { normalizeFieldOption } from "@/lib/types";

const TYPE_OPTIONS: Array<{ value: InputFieldDef["type"]; label: string }> = [
  { value: "text", label: "单行文本" },
  { value: "textarea", label: "多行文本" },
  { value: "url", label: "URL" },
  { value: "number", label: "数字" },
  { value: "toggle", label: "开关" },
  { value: "select", label: "单选" },
  { value: "multiselect", label: "多选" },
  { value: "date", label: "日期" },
  { value: "daterange", label: "日期范围" },
];

/**
 * 新字段默认名留空会导致：
 *  - 启动表单里两个未命名字段共用同一状态槽（前面修过的"改 B 连带改 A" bug）
 *  - 步骤参数绑定下拉里无法显示该字段
 *  - Mustache 模板 `{{}}` 永远渲染成空字符串
 * 这里用函数式默认名 `field_N`，调用方可覆盖。用户 *一定* 会直接忽略 name
 * 输入框（常见误解：以为 placeholder 就是默认值），自动预填一个合法名最省心。
 */
function defaultField(existingCount: number): InputFieldDef {
  return {
    name: `field_${existingCount + 1}`,
    label: "",
    type: "text",
  };
}

export interface InputFieldsEditorProps {
  value: InputFieldDef[];
  onChange: (fields: InputFieldDef[]) => void;
}

export function InputFieldsEditor({ value, onChange }: InputFieldsEditorProps) {
  // Stable per-row keys. Using `key={index}` caused React to reuse the same
  // DOM node (with its browser-level input state like IME composition /
  // autofill) across *different* field rows when users added/removed/reordered
  // fields — producing the "edit field 2, field 1 changes" symptom. We keep a
  // ref-based id array that's mutated in lockstep with `value` so each row
  // keeps its own identity across renders even when the parent passes in a
  // fresh array reference on every change.
  const idsRef = React.useRef<string[]>([]);
  if (idsRef.current.length !== value.length) {
    // Grow / shrink to match current length. New slots get fresh UUIDs.
    while (idsRef.current.length < value.length) {
      idsRef.current.push(
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `field-${Math.random().toString(36).slice(2)}-${idsRef.current.length}`,
      );
    }
    idsRef.current.length = value.length;
  }

  function patch(i: number, patchObj: Partial<InputFieldDef>) {
    const next = value.map((f, idx) => (idx === i ? { ...f, ...patchObj } : f));
    onChange(next);
  }
  function remove(i: number) {
    idsRef.current.splice(i, 1);
    onChange(value.filter((_, idx) => idx !== i));
  }
  function move(i: number, delta: -1 | 1) {
    const j = i + delta;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    // Keep ids aligned with their rows so each row preserves its identity
    // (and DOM state) after the swap.
    [idsRef.current[i], idsRef.current[j]] = [idsRef.current[j], idsRef.current[i]];
    onChange(next);
  }
  function add() {
    onChange([...value, defaultField(value.length)]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">输入字段</h3>
        <Button size="sm" variant="ghost" onClick={add}>
          <Plus className="mr-1 h-4 w-4" />
          新增字段
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
          暂无字段（launchMode=direct 时可留空）
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((f, i) => (
            <FieldRow
              key={idsRef.current[i]}
              field={f}
              onPatch={(p) => patch(i, p)}
              onRemove={() => remove(i)}
              onMove={(d) => move(i, d)}
              canMoveUp={i > 0}
              canMoveDown={i < value.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  field,
  onPatch,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  field: InputFieldDef;
  onPatch: (p: Partial<InputFieldDef>) => void;
  onRemove: () => void;
  onMove: (d: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="rounded-xl border border-sky-100 bg-white/50 p-3 space-y-3">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-3 min-w-0">
          <label className="block truncate whitespace-nowrap text-xs text-muted-foreground">
            类型
          </label>
          <Select
            value={field.type}
            onValueChange={(v) =>
              onPatch({ type: v as InputFieldDef["type"] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3 min-w-0">
          <label
            className="block truncate whitespace-nowrap text-xs text-muted-foreground"
            title="字段名（英文，仅小写字母/下划线）"
          >
            字段名（英文）
          </label>
          <Input
            value={field.name}
            onChange={(e) =>
              onPatch({ name: e.target.value.replace(/[^a-z_]/g, "") })
            }
            placeholder="例：topic_title"
          />
        </div>
        <div className="col-span-3 min-w-0">
          <label
            className="block truncate whitespace-nowrap text-xs text-muted-foreground"
            title="显示标签（中文）"
          >
            显示标签
          </label>
          <Input
            value={field.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder="例：事件主题"
          />
        </div>
        <div className="col-span-3 flex min-w-0 flex-col">
          {/* 不可见 label 占位 —— 与前三列的 label 行同高，保证下方控件与输入框顶部对齐 */}
          <label
            aria-hidden="true"
            className="block truncate whitespace-nowrap text-xs text-transparent select-none"
          >
            .
          </label>
          <div className="flex h-9 items-center gap-1 flex-nowrap">
            <div className="flex shrink-0 items-center gap-1.5">
              <Switch
                checked={!!field.required}
                onCheckedChange={(c) => onPatch({ required: c })}
              />
              <span className="whitespace-nowrap text-xs">必填</span>
            </div>
            <div className="ml-auto flex shrink-0 items-center">
              <Button
                size="icon"
                variant="ghost"
                disabled={!canMoveUp}
                onClick={() => onMove(-1)}
                className="h-7 w-7"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={!canMoveDown}
                onClick={() => onMove(1)}
                className="h-7 w-7"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onRemove}
                className="h-7 w-7"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">placeholder / 说明</label>
        <Input
          value={field.placeholder ?? ""}
          onChange={(e) => onPatch({ placeholder: e.target.value })}
        />
      </div>

      {(field.type === "select" || field.type === "multiselect") && (
        <OptionsEditor
          options={field.options ?? []}
          onChange={(opts) => onPatch({ options: opts })}
        />
      )}

      {field.type === "number" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">min</label>
            <Input
              type="number"
              value={field.validation?.min ?? ""}
              onChange={(e) =>
                onPatch({
                  validation: {
                    ...field.validation,
                    min:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">max</label>
            <Input
              type="number"
              value={field.validation?.max ?? ""}
              onChange={(e) =>
                onPatch({
                  validation: {
                    ...field.validation,
                    max:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  },
                })
              }
            />
          </div>
        </div>
      )}

      {(field.type === "text" ||
        field.type === "textarea" ||
        field.type === "url") && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">minLength</label>
            <Input
              type="number"
              value={field.validation?.minLength ?? ""}
              onChange={(e) =>
                onPatch({
                  validation: {
                    ...field.validation,
                    minLength:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">maxLength</label>
            <Input
              type="number"
              value={field.validation?.maxLength ?? ""}
              onChange={(e) =>
                onPatch({
                  validation: {
                    ...field.validation,
                    maxLength:
                      e.target.value === "" ? undefined : Number(e.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">pattern（regex）</label>
            <Input
              value={field.validation?.pattern ?? ""}
              onChange={(e) =>
                onPatch({
                  validation: {
                    ...field.validation,
                    pattern: e.target.value === "" ? undefined : e.target.value,
                  },
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: InputFieldOption[];
  onChange: (o: InputFieldOption[]) => void;
}) {
  const normalized = options.map(normalizeFieldOption);
  // Same stable-key strategy as InputFieldsEditor — avoids DOM state bleeding
  // across option rows when users add/remove options.
  const idsRef = React.useRef<string[]>([]);
  if (idsRef.current.length !== normalized.length) {
    while (idsRef.current.length < normalized.length) {
      idsRef.current.push(
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `opt-${Math.random().toString(36).slice(2)}-${idsRef.current.length}`,
      );
    }
    idsRef.current.length = normalized.length;
  }

  function patch(i: number, patchObj: Partial<{ value: string; label: string }>) {
    const next = [...normalized];
    next[i] = { ...next[i], ...patchObj };
    onChange(next);
  }
  function remove(i: number) {
    idsRef.current.splice(i, 1);
    onChange(normalized.filter((_, idx) => idx !== i));
  }
  function add() {
    onChange([...normalized, { value: "", label: "" }]);
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs text-muted-foreground">选项</label>
        <Button size="sm" variant="ghost" onClick={add}>
          <Plus className="mr-1 h-3 w-3" />
          新增选项
        </Button>
      </div>
      <div className="space-y-2">
        {normalized.map((o, i) => (
          <div key={idsRef.current[i]} className="grid grid-cols-12 gap-2">
            <Input
              className="col-span-5"
              value={o.value}
              onChange={(e) => patch(i, { value: e.target.value })}
              placeholder="value"
            />
            <Input
              className="col-span-6"
              value={o.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              placeholder="显示文本"
            />
            <Button
              size="icon"
              variant="ghost"
              className="col-span-1"
              onClick={() => remove(i)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
