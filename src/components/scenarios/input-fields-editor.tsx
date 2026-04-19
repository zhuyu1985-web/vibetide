"use client";

import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/shared/glass-card";
import type { InputFieldDef } from "@/lib/types";

interface InputFieldsEditorProps {
  value: InputFieldDef[];
  onChange: (fields: InputFieldDef[]) => void;
}

const EMPTY_FIELD: InputFieldDef = {
  name: "",
  label: "",
  type: "text",
  required: true,
};

export function InputFieldsEditor({ value, onChange }: InputFieldsEditorProps) {
  const update = (index: number, patch: Partial<InputFieldDef>) => {
    const next = [...value];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const add = () => onChange([...value, { ...EMPTY_FIELD }]);
  const remove = (index: number) =>
    onChange(value.filter((_, i) => i !== index));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          暂无输入参数。没有参数时场景会直接发送系统指令。
        </div>
      )}

      {value.map((field, i) => (
        <GlassCard key={i} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              参数 {i + 1}
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label="上移"
              >
                <ArrowUp size={12} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => move(i, i + 1)}
                disabled={i === value.length - 1}
                aria-label="下移"
              >
                <ArrowDown size={12} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(i)}
                aria-label="删除参数"
              >
                <Trash2 size={12} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">参数名（变量）</Label>
              <Input
                value={field.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="topic"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">显示名</Label>
              <Input
                value={field.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="话题"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">类型</Label>
              <Select
                value={field.type}
                onValueChange={(v: InputFieldDef["type"]) =>
                  update(i, { type: v })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">单行文本</SelectItem>
                  <SelectItem value="textarea">多行文本</SelectItem>
                  <SelectItem value="select">下拉选择</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-xs">占位符</Label>
                <Input
                  value={field.placeholder ?? ""}
                  onChange={(e) =>
                    update(i, { placeholder: e.target.value || undefined })
                  }
                  placeholder="（可选）"
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-1 pb-2">
                <Switch
                  checked={field.required}
                  onCheckedChange={(v) => update(i, { required: v })}
                />
                <span className="text-xs">必填</span>
              </div>
            </div>
          </div>

          {field.type === "select" && (
            <div>
              <Label className="text-xs">选项（每行一个）</Label>
              <Textarea
                value={(field.options ?? []).join("\n")}
                onChange={(e) =>
                  update(i, {
                    options: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                placeholder={"选项 A\n选项 B\n选项 C"}
                className="mt-1 min-h-[80px]"
              />
            </div>
          )}
        </GlassCard>
      ))}

      <Button variant="ghost" size="sm" onClick={add} className="w-full">
        <Plus size={14} className="mr-1" />
        添加参数
      </Button>
    </div>
  );
}
