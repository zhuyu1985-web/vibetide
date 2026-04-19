"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, AlertTriangle, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InputFieldsEditor } from "./input-fields-editor";
import {
  createScenario,
  updateScenario,
  type ScenarioWritePayload,
} from "@/app/actions/scenarios";
import type { ScenarioAdminRow } from "@/lib/dal/scenarios";
import type { InputFieldDef } from "@/lib/types";

// Common Lucide icon names users are likely to pick. Custom names still work
// — this is just a convenience shortlist, not a validation gate.
const ICON_CHOICES = [
  "Zap", "Sparkles", "Radar", "Search", "FileText", "PenTool",
  "BarChart3", "Activity", "Lightbulb", "Users", "Film", "Image",
  "Music", "CheckCircle", "Shield", "Radio", "TrendingUp", "BookOpen",
  "Package", "FolderOpen", "Type", "RefreshCw", "CalendarDays",
  "RotateCcw", "MessageSquare",
];

interface ScenarioEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeSlug: string;
  scenario: ScenarioAdminRow | null;
  defaultSortOrder: number;
  onSaved: () => void;
}

type FormState = {
  name: string;
  description: string;
  icon: string;
  welcomeMessage: string;
  systemInstruction: string;
  inputFields: InputFieldDef[];
  toolsHint: string;
  sortOrder: number;
  enabled: boolean;
};

const BLANK: FormState = {
  name: "",
  description: "",
  icon: "Zap",
  welcomeMessage: "",
  systemInstruction: "",
  inputFields: [],
  toolsHint: "",
  sortOrder: 0,
  enabled: true,
};

function toForm(s: ScenarioAdminRow | null, defaultSortOrder: number): FormState {
  if (!s) return { ...BLANK, sortOrder: defaultSortOrder };
  return {
    name: s.name,
    description: s.description,
    icon: s.icon,
    welcomeMessage: s.welcomeMessage ?? "",
    systemInstruction: s.systemInstruction,
    inputFields: s.inputFields,
    toolsHint: s.toolsHint.join(", "),
    sortOrder: s.sortOrder,
    enabled: s.enabled,
  };
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function findPlaceholders(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(PLACEHOLDER_RE)) {
    const name = m[1];
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

export function ScenarioEditorSheet({
  open,
  onOpenChange,
  employeeSlug,
  scenario,
  defaultSortOrder,
  onSaved,
}: ScenarioEditorSheetProps) {
  const [form, setForm] = useState<FormState>(() =>
    toForm(scenario, defaultSortOrder),
  );
  const [saving, setSaving] = useState(false);

  // Reset form whenever the editor opens for a different scenario. Keeping
  // this inside an effect (rather than deriving every render) prevents
  // keystrokes in the inputs from being clobbered by re-renders of the parent.
  useEffect(() => {
    if (open) setForm(toForm(scenario, defaultSortOrder));
  }, [open, scenario, defaultSortOrder]);

  // Live placeholder validation: highlight which {{foo}} tokens in the
  // instruction / welcome text don't yet have a matching input field.
  const unresolvedPlaceholders = useMemo(() => {
    const fieldNames = new Set(form.inputFields.map((f) => f.name));
    const used = [
      ...findPlaceholders(form.systemInstruction),
      ...findPlaceholders(form.welcomeMessage),
    ];
    const seen = new Set<string>();
    const unresolved: string[] = [];
    for (const name of used) {
      if (fieldNames.has(name)) continue;
      if (seen.has(name)) continue;
      seen.add(name);
      unresolved.push(name);
    }
    return unresolved;
  }, [form.inputFields, form.systemInstruction, form.welcomeMessage]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: ScenarioWritePayload = {
        employeeSlug,
        name: form.name.trim(),
        description: form.description.trim(),
        icon: form.icon.trim() || "Zap",
        welcomeMessage: form.welcomeMessage.trim() || null,
        systemInstruction: form.systemInstruction.trim(),
        inputFields: form.inputFields,
        toolsHint: form.toolsHint
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        sortOrder: form.sortOrder,
        enabled: form.enabled,
      };

      if (scenario) {
        await updateScenario(scenario.id, payload);
        toast.success("场景已更新");
      } else {
        await createScenario(payload);
        toast.success("场景已创建");
      }
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[720px] sm:max-w-[720px] flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {scenario ? `编辑场景：${scenario.name}` : "新建预设场景"}
          </SheetTitle>
          <SheetDescription>
            场景会出现在首页和对话中心的员工入口，支持参数化指令和欢迎词。
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* ── 基本信息 ── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              基本信息
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">场景名称</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="如：全网热点扫描"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">图标（Lucide）</Label>
                <Select
                  value={form.icon}
                  onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {ICON_CHOICES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">描述</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="一句话说明场景用途"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, enabled: v }))
                  }
                />
                <Label className="text-xs">启用</Label>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Label className="text-xs">排序</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-20 text-right"
                />
              </div>
            </div>
          </section>

          {/* ── 欢迎词 ── */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={12} />
              欢迎词（可选）
            </h3>
            <Textarea
              value={form.welcomeMessage}
              onChange={(e) =>
                setForm((f) => ({ ...f, welcomeMessage: e.target.value }))
              }
              placeholder="例：你好，我是小雷。请告诉我你关注的领域，我会扫描全网热点。"
              className="min-h-[80px]"
            />
            <p className="text-[11px] text-muted-foreground">
              用户打开该场景时的首句。留空则不发送欢迎词。支持 Markdown 和
              {" {{变量}} "}占位符。
            </p>
          </section>

          {/* ── 系统指令 + 输入参数 ── */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              系统指令
            </h3>
            <Textarea
              value={form.systemInstruction}
              onChange={(e) =>
                setForm((f) => ({ ...f, systemInstruction: e.target.value }))
              }
              placeholder="请对{{domain}}领域进行全网热点扫描…"
              className="min-h-[160px] font-mono text-xs"
            />

            {unresolvedPlaceholders.length > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>
                  未定义的变量：
                  {unresolvedPlaceholders
                    .map((n) => `{{${n}}}`)
                    .join("、")}
                  。请在下方新增同名输入参数。
                </span>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              输入参数
            </h3>
            <InputFieldsEditor
              value={form.inputFields}
              onChange={(fields) =>
                setForm((f) => ({ ...f, inputFields: fields }))
              }
            />
          </section>

          <section>
            <Label className="text-xs">工具提示（可选，逗号分隔）</Label>
            <Input
              value={form.toolsHint}
              onChange={(e) =>
                setForm((f) => ({ ...f, toolsHint: e.target.value }))
              }
              placeholder="web_search, trending_topics"
              className="mt-1 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              告诉 Agent 该场景倾向使用的技能工具，纯提示，不强制。
            </p>
          </section>
        </div>

        <SheetFooter className="border-t border-border px-6 py-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || unresolvedPlaceholders.length > 0}
          >
            {saving && <Loader2 size={14} className="mr-1 animate-spin" />}
            {scenario ? "保存修改" : "创建场景"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
