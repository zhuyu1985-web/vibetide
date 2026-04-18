"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import type { ConfigField } from "@/lib/collection/types";
import { createCollectionSource } from "@/app/actions/collection";

const CRON_PRESETS = [
  { value: "__manual__", label: "手工触发" },
  { value: "*/15 * * * *", label: "每 15 分钟" },
  { value: "0 * * * *", label: "每小时" },
  { value: "0 */6 * * *", label: "每 6 小时" },
  { value: "0 8 * * *", label: "每日 8:00" },
  { value: "0 0 * * 0", label: "每周日 0:00" },
];

const TARGET_MODULES = [
  { value: "hot_topics", label: "热点 (hot_topics)" },
  { value: "news", label: "研究 (news)" },
  { value: "benchmarking", label: "对标 (benchmarking)" },
  { value: "knowledge", label: "知识库 (knowledge)" },
];

interface NewSourceWizardClientProps {
  adapterMetas: AdapterMeta[];
}

export function NewSourceWizardClient({ adapterMetas }: NewSourceWizardClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [sourceType, setSourceType] = useState<string>("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [scheduleCron, setScheduleCron] = useState<string>("__manual__");
  const [targetModules, setTargetModules] = useState<string[]>([]);
  const [defaultCategory, setDefaultCategory] = useState<string>("");
  const [defaultTagsRaw, setDefaultTagsRaw] = useState<string>("");
  const [name, setName] = useState<string>("");

  const selectedMeta = adapterMetas.find((m) => m.type === sourceType);

  const canAdvance = () => {
    if (step === 1) return Boolean(sourceType);
    if (step === 2) return selectedMeta?.configFields.every((f) => {
      if (!f.required) return true;
      const v = config[f.key];
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== null && v !== "";
    });
    if (step === 3) return true;
    if (step === 4) return name.trim().length > 0;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const tags = defaultTagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
      const effectiveCron = scheduleCron === "__manual__" ? null : scheduleCron;
      const { sourceId } = await createCollectionSource({
        name: name.trim(),
        sourceType,
        config,
        scheduleCron: effectiveCron,
        targetModules,
        defaultCategory: defaultCategory.trim() || null,
        defaultTags: tags.length > 0 ? tags : null,
      });
      toast.success("源创建成功");
      router.push(`/data-collection/sources/${sourceId}`);
    } catch (err) {
      toast.error(`创建失败: ${err instanceof Error ? err.message : String(err)}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/data-collection/sources" className="text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="inline h-4 w-4" />返回
        </Link>
      </div>
      <h2 className="text-2xl font-semibold">新建采集源</h2>

      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`flex-1 h-1 rounded ${n <= step ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">1. 选择源类型</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {adapterMetas.map((m) => (
              <button
                key={m.type}
                type="button"
                onClick={() => { setSourceType(m.type); setConfig({}); }}
                className={`text-left p-4 rounded-lg border transition-colors ${
                  sourceType === m.type ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <div className="font-medium">{m.displayName}</div>
                <div className="text-xs text-muted-foreground mt-1">{m.description}</div>
                <div className="text-xs text-muted-foreground mt-2">类型: {m.category}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && selectedMeta && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">2. 配置 {selectedMeta.displayName}</h3>
          {selectedMeta.configFields.map((f) => (
            <ConfigFieldInput
              key={f.key}
              field={f}
              value={config[f.key]}
              onChange={(v) => setConfig({ ...config, [f.key]: v })}
            />
          ))}
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">3. 调度与分类</h3>
          <div>
            <Label>调度频率</Label>
            <Select value={scheduleCron} onValueChange={setScheduleCron}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CRON_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">选择"手工触发"后源只能手动运行。</p>
          </div>
          <div>
            <Label>归属模块(采集到的内容会派生到这些模块)</Label>
            <div className="flex flex-col gap-2 mt-2">
              {TARGET_MODULES.map((m) => (
                <label key={m.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={targetModules.includes(m.value)}
                    onCheckedChange={(checked) => {
                      if (checked) setTargetModules([...targetModules, m.value]);
                      else setTargetModules(targetModules.filter((v) => v !== m.value));
                    }}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="defaultCategory">默认分类(可选)</Label>
            <Input
              id="defaultCategory"
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              placeholder="如:要闻/科技/体育"
            />
          </div>
          <div>
            <Label htmlFor="defaultTags">默认标签(可选,逗号分隔)</Label>
            <Input
              id="defaultTags"
              value={defaultTagsRaw}
              onChange={(e) => setDefaultTagsRaw(e.target.value)}
              placeholder="如:热榜,每日"
            />
          </div>
        </section>
      )}

      {step === 4 && selectedMeta && (
        <section className="flex flex-col gap-4">
          <h3 className="text-lg font-medium">4. 命名 & 确认</h3>
          <div>
            <Label htmlFor="name">源名称 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:微博抖音小红书热榜"
              autoFocus
            />
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
            <div><span className="text-muted-foreground">类型: </span>{selectedMeta.displayName}</div>
            <div><span className="text-muted-foreground">调度: </span>{CRON_PRESETS.find((p) => p.value === scheduleCron)?.label ?? "自定义"}</div>
            <div><span className="text-muted-foreground">归属模块: </span>{targetModules.join(", ") || "无"}</div>
            <div><span className="text-muted-foreground">配置: </span><code className="text-xs">{JSON.stringify(config)}</code></div>
          </div>
        </section>
      )}

      <div className="flex justify-between pt-4 border-t border-border/30">
        <Button
          variant="outline"
          disabled={step === 1}
          onClick={() => setStep(step - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />上一步
        </Button>
        {step < 4 ? (
          <Button disabled={!canAdvance()} onClick={() => setStep(step + 1)}>
            下一步<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button disabled={!canAdvance() || submitting} onClick={handleSubmit}>
            {submitting ? "创建中..." : "确认创建"}
          </Button>
        )}
      </div>
    </div>
  );
}

interface ConfigFieldInputProps {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}

function ConfigFieldInput({ field, value, onChange }: ConfigFieldInputProps) {
  return (
    <div>
      <Label htmlFor={field.key}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderInput(field, value, onChange)}
      {field.help && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
    </div>
  );
}

function renderInput(field: ConfigField, value: unknown, onChange: (v: unknown) => void) {
  switch (field.type) {
    case "text":
    case "url":
      return (
        <Input
          id={field.key}
          type={field.type}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "textarea":
      return (
        <Textarea
          id={field.key}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          id={field.key}
          type="number"
          value={(value as number | undefined) ?? ""}
          min={field.validation?.min}
          max={field.validation?.max}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.key}
            checked={Boolean(value)}
            onCheckedChange={(c) => onChange(Boolean(c))}
          />
        </div>
      );
    case "select":
      return (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={field.help ?? "请选择"} /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect":
      return <MultiSelectInput field={field} value={value} onChange={onChange} />;
    case "kv":
      return (
        <Textarea
          id={field.key}
          value={value ? JSON.stringify(value, null, 2) : ""}
          rows={4}
          placeholder='{"key": "value"}'
          onChange={(e) => {
            try {
              onChange(e.target.value ? JSON.parse(e.target.value) : {});
            } catch {
              // keep invalid text, let user fix
            }
          }}
        />
      );
  }
}

interface MultiSelectInputProps {
  field: ConfigField;
  value: unknown;
  onChange: (v: unknown) => void;
}

function MultiSelectInput({ field, value, onChange }: MultiSelectInputProps) {
  const arr = Array.isArray(value) ? (value as string[]) : [];
  const opts = field.options;

  if (opts) {
    return (
      <div className="flex flex-wrap gap-3 mt-2">
        {opts.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={arr.includes(o.value)}
              onCheckedChange={(c) => {
                if (c) onChange([...arr, o.value]);
                else onChange(arr.filter((v) => v !== o.value));
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  return (
    <Input
      id={field.key}
      value={arr.join(", ")}
      placeholder="逗号分隔多个值"
      onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
    />
  );
}
