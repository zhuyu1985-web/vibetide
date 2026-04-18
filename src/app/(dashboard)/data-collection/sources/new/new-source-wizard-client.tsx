"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
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

  const STEP_LABELS = ["选择源类型", "配置参数", "调度与分类", "命名与确认"];

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/data-collection/sources" className="text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="inline h-4 w-4" />返回源列表
        </Link>
      </div>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">新建采集源</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          4 步完成配置,采集到的内容会自动派生到指定业务模块。
        </p>
      </div>

      {/* Numbered step indicator */}
      <ol className="flex items-center gap-0">
        {STEP_LABELS.map((label, idx) => {
          const n = idx + 1;
          const done = n < step;
          const active = n === step;
          return (
            <li key={n} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    done
                      ? "bg-primary text-primary-foreground"
                      : active
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                        : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                <span
                  className={[
                    "text-xs whitespace-nowrap",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {label}
                </span>
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div className={["mx-3 h-px flex-1", done ? "bg-primary" : "bg-border"].join(" ")} />
              )}
            </li>
          );
        })}
      </ol>

      {/* Step content card */}
      <div className="rounded-xl border bg-card p-6 shadow-sm">
      {step === 1 && (
        <section className="flex flex-col gap-4">
          <div>
            <h3 className="text-base font-medium">选择要添加的源类型</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              不同类型对应不同的采集方式,选择最符合目标数据的那种。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {adapterMetas.map((m) => {
              const picked = sourceType === m.type;
              return (
                <button
                  key={m.type}
                  type="button"
                  onClick={() => { setSourceType(m.type); setConfig({}); }}
                  className={[
                    "text-left p-4 rounded-lg border-2 transition-all",
                    picked
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-transparent bg-muted/30 hover:bg-muted/60 hover:border-border",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{m.displayName}</div>
                    {picked && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{m.description}</p>
                  <div className="mt-3 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {m.category}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {step === 2 && selectedMeta && (
        <section className="flex flex-col gap-5">
          <div>
            <h3 className="text-base font-medium">配置 {selectedMeta.displayName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{selectedMeta.description}</p>
          </div>
          <div className="flex flex-col gap-5">
            {selectedMeta.configFields.map((f) => (
              <ConfigFieldInput
                key={f.key}
                field={f}
                value={config[f.key]}
                onChange={(v) => setConfig({ ...config, [f.key]: v })}
              />
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="flex flex-col gap-5">
          <div>
            <h3 className="text-base font-medium">调度与分类</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              决定这个源什么时候运行,以及采集到的内容如何被下游使用。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>调度频率</Label>
            <Select value={scheduleCron} onValueChange={setScheduleCron}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CRON_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">选择"手工触发"后源只能手动运行。</p>
          </div>
          <div className="space-y-1.5">
            <Label>归属模块</Label>
            <p className="text-xs text-muted-foreground">采集到的内容会派生到这些模块,后续可在内容浏览页按此筛选。</p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {TARGET_MODULES.map((m) => {
                const on = targetModules.includes(m.value);
                return (
                  <label
                    key={m.value}
                    className={[
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm cursor-pointer transition-colors",
                      on ? "bg-primary/5" : "bg-muted/30 hover:bg-muted/50",
                    ].join(" ")}
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={(checked) => {
                        if (checked) setTargetModules([...targetModules, m.value]);
                        else setTargetModules(targetModules.filter((v) => v !== m.value));
                      }}
                    />
                    {m.label}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="defaultCategory">默认分类 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <Input
                id="defaultCategory"
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
                placeholder="如: 要闻 / 科技 / 体育"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultTags">默认标签 <span className="text-muted-foreground font-normal">(可选,逗号分隔)</span></Label>
              <Input
                id="defaultTags"
                value={defaultTagsRaw}
                onChange={(e) => setDefaultTagsRaw(e.target.value)}
                placeholder="如: 热榜, 每日"
              />
            </div>
          </div>
        </section>
      )}

      {step === 4 && selectedMeta && (
        <section className="flex flex-col gap-5">
          <div>
            <h3 className="text-base font-medium">命名并确认</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              给这个源起一个能区分于其他源的名字。下方可最后检查配置。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">源名称 *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 微博 / 抖音 / 小红书 热榜"
              autoFocus
            />
          </div>
          <div className="rounded-lg bg-muted/30 p-4 text-sm space-y-2.5">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              配置预览
            </div>
            <div className="grid grid-cols-[80px_1fr] gap-y-1.5 text-sm">
              <span className="text-muted-foreground">类型</span>
              <span>{selectedMeta.displayName}</span>
              <span className="text-muted-foreground">调度</span>
              <span>{CRON_PRESETS.find((p) => p.value === scheduleCron)?.label ?? "自定义"}</span>
              <span className="text-muted-foreground">归属模块</span>
              <span>{targetModules.join(", ") || "无"}</span>
              {defaultCategory && (
                <>
                  <span className="text-muted-foreground">默认分类</span>
                  <span>{defaultCategory}</span>
                </>
              )}
              <span className="text-muted-foreground self-start">参数</span>
              <pre className="text-xs font-mono bg-background/50 rounded px-2 py-1.5 overflow-x-auto max-w-full">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      )}
      </div>

      <div className="flex justify-between pt-2">
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
