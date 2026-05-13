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
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, type OutletTier } from "@/lib/collection/constants";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";

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

export interface WizardOutletOption {
  id: string;
  outletName: string;
  outletTier: string;
  /** M4: 该 outlet 在各平台的账号矩阵(从 channels jsonb)。tikhub account 模式联动用 */
  channels: Array<{ type: string; nickname?: string; name?: string }>;
}

interface NewSourceWizardClientProps {
  adapterMetas: AdapterMeta[];
  outlets: WizardOutletOption[];
}

const TIKHUB_ACCOUNT_PLATFORMS = [
  { value: "douyin", label: "抖音" },
  { value: "weibo", label: "微博" },
  { value: "kuaishou", label: "快手" },
  { value: "wechat_oa", label: "微信公众号" },
] as const;

export function NewSourceWizardClient({ adapterMetas, outlets }: NewSourceWizardClientProps) {
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
  // Outlet fields
  const [outletId, setOutletId] = useState<string>("__none__");
  const [defaultOutletTier, setDefaultOutletTier] = useState<string>("__none__");
  const [defaultOutletRegion, setDefaultOutletRegion] = useState<string>("");

  const selectedMeta = adapterMetas.find((m) => m.type === sourceType);

  const canAdvance = () => {
    if (step === 1) return Boolean(sourceType);
    if (step === 2) {
      // tikhub 走自定义校验:keyword 模式需 platform+keywords;account 模式需 accountPlatforms[]+outletIds[]
      if (selectedMeta?.type === "tikhub") {
        const mode = (config.mode as string) ?? "keyword";
        if (mode === "keyword") {
          return Boolean(config.platform) && Array.isArray(config.keywords) && (config.keywords as string[]).length > 0;
        }
        const platforms = config.accountPlatforms;
        const outletIds = config.outletIds;
        return (
          Array.isArray(platforms) && (platforms as string[]).length > 0 &&
          Array.isArray(outletIds) && (outletIds as string[]).length > 0
        );
      }
      return selectedMeta?.configFields.every((f) => {
        if (!f.required) return true;
        const v = config[f.key];
        if (Array.isArray(v)) return v.length > 0;
        return v !== undefined && v !== null && v !== "";
      });
    }
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
        outletId: outletId === "__none__" ? null : outletId,
        defaultOutletTier: defaultOutletTier === "__none__" ? null : defaultOutletTier,
        defaultOutletRegion: defaultOutletRegion.trim() || null,
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
        <section className="flex flex-col gap-6">
          <div>
            <h3 className="text-base font-medium">配置 {selectedMeta.displayName}</h3>
            <p className="text-xs text-muted-foreground mt-1">{selectedMeta.description}</p>
          </div>
          {selectedMeta.type === "tikhub" ? (
            <TikhubConfigPanel
              config={config}
              setConfig={setConfig}
              outlets={outlets}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {selectedMeta.configFields.map((f) => (
                <ConfigFieldInput
                  key={f.key}
                  field={f}
                  value={config[f.key]}
                  onChange={(v) => setConfig({ ...config, [f.key]: v })}
                />
              ))}
            </div>
          )}
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
            <Label>归属模块（标签,不复制数据）</Label>
            <p className="text-xs text-muted-foreground">
              给这个采集源贴上"服务于哪些下游模块"的标签 — 仅用于在采集池/研究工作台里按此过滤,
              <strong className="text-foreground">不会把数据再复制一份到任何业务表</strong>。
              所有研究/检索/报告都直接读采集池(collected_items),单一真相源。
              <br />
              热点(hot_topics)是特例:勾选后会额外触发 LLM 富化流水线写 hot_topics 表。
            </p>
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

          {/* Outlet fields */}
          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label className="text-sm font-medium">媒体归属 <span className="text-muted-foreground font-normal">(可选)</span></Label>
              <p className="text-xs text-muted-foreground mt-0.5">将该源采集的内容归属到具体媒体，可用于后续内容分级筛选。</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>绑定媒体</Label>
                <Select value={outletId} onValueChange={setOutletId}>
                  <SelectTrigger>
                    <SelectValue placeholder="未绑定" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">未绑定</SelectItem>
                    {outlets.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.outletName}（{OUTLET_TIER_LABELS[o.outletTier as OutletTier] ?? o.outletTier}）
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>默认分级（兜底）</Label>
                <Select value={defaultOutletTier} onValueChange={setDefaultOutletTier}>
                  <SelectTrigger>
                    <SelectValue placeholder="无" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">无</SelectItem>
                    {OUTLET_TIER_VALUES.map((t) => (
                      <SelectItem key={t} value={t}>{OUTLET_TIER_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="defaultOutletRegion">默认区域</Label>
                <Input
                  id="defaultOutletRegion"
                  value={defaultOutletRegion}
                  onChange={(e) => setDefaultOutletRegion(e.target.value)}
                  placeholder="如: 重庆 / 全国"
                />
              </div>
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
  // Boolean: label 与 checkbox 平排 (左 checkbox / 右 label),help 放下面
  if (field.type === "boolean") {
    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={field.key}
          className="flex items-center gap-2 cursor-pointer text-sm"
        >
          <Checkbox
            id={field.key}
            checked={Boolean(value)}
            onCheckedChange={(c) => onChange(Boolean(c))}
          />
          <span>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </span>
        </label>
        {field.help && (
          <p className="text-xs text-muted-foreground pl-6">{field.help}</p>
        )}
      </div>
    );
  }

  // 其余: label / input / help 上下三段,组内 8px,组间靠外层 gap 控制
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={field.key}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderInput(field, value, onChange)}
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
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
      // boolean 在 ConfigFieldInput 自己渲染(label+checkbox 同行),不会走到这里
      return null;
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

interface OutletMultiPickerProps {
  eligibleOutlets: WizardOutletOption[];
  accountPlatforms: string[];
  selected: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

function OutletMultiPicker({
  eligibleOutlets,
  accountPlatforms,
  selected,
  onToggle,
  onSelectAll,
  onClear,
}: OutletMultiPickerProps) {
  const [search, setSearch] = useState("");
  const filtered = search.trim()
    ? eligibleOutlets.filter((o) =>
        o.outletName.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : eligibleOutlets;
  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.includes(o.id));
  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`搜索媒体名（共 ${eligibleOutlets.length} 个候选）`}
          className="h-8 text-xs flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          className="h-8 text-xs"
          onClick={allFilteredSelected ? onClear : onSelectAll}
        >
          {allFilteredSelected ? "清空" : "全选"}
        </Button>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">没有匹配的媒体</div>
        ) : (
          filtered.map((o) => {
            const matched = o.channels
              .filter((c) => accountPlatforms.includes(c.type))
              .map((c) => c.type);
            const on = selected.includes(o.id);
            return (
              <label
                key={o.id}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer border-b last:border-b-0 transition-colors ${
                  on ? "bg-primary/5" : "hover:bg-muted/40"
                }`}
              >
                <Checkbox checked={on} onCheckedChange={() => onToggle(o.id)} />
                <span className="flex-1 truncate">{o.outletName}</span>
                <div className="flex gap-1 shrink-0">
                  {matched.map((t) => (
                    <span
                      key={t}
                      className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {TIKHUB_ACCOUNT_PLATFORMS.find((p) => p.value === t)?.label ?? t}
                    </span>
                  ))}
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// TikhubConfigPanel — M4: tikhub 专用配置面板,支持 keyword / account 双模式
// ───────────────────────────────────────────────────────────────────────

interface TikhubConfigPanelProps {
  config: Record<string, unknown>;
  setConfig: (next: Record<string, unknown>) => void;
  outlets: WizardOutletOption[];
}

function TikhubConfigPanel({ config, setConfig, outlets }: TikhubConfigPanelProps) {
  const mode = (config.mode as string) ?? "keyword";
  const accountPlatforms = Array.isArray(config.accountPlatforms)
    ? (config.accountPlatforms as string[])
    : [];
  const outletIds = Array.isArray(config.outletIds) ? (config.outletIds as string[]) : [];

  function patch(p: Record<string, unknown>) {
    setConfig({ ...config, ...p });
  }

  function toggleAccountPlatform(value: string) {
    const next = accountPlatforms.includes(value)
      ? accountPlatforms.filter((v) => v !== value)
      : [...accountPlatforms, value];
    // 平台变更后,清理掉那些"在剩余平台里一个 channel 都没有"的 outlet
    const stillValidOutletIds = outletIds.filter((id) => {
      const o = outlets.find((x) => x.id === id);
      return o?.channels.some((c) => next.includes(c.type));
    });
    patch({ accountPlatforms: next, outletIds: stillValidOutletIds });
  }

  function toggleOutletId(id: string) {
    const next = outletIds.includes(id)
      ? outletIds.filter((v) => v !== id)
      : [...outletIds, id];
    patch({ outletIds: next });
  }

  // 把已选平台 + 媒体筛出来:必须该 outlet 至少在已选平台之一上有 channel
  const eligibleOutlets =
    accountPlatforms.length === 0
      ? []
      : outlets.filter((o) =>
          o.channels.some((c) => accountPlatforms.includes(c.type)),
        );

  return (
    <div className="flex flex-col gap-6">
      {/* Mode 切换 */}
      <div className="space-y-1.5">
        <Label>采集模式</Label>
        <div className="flex rounded-md border overflow-hidden w-fit">
          <button
            type="button"
            onClick={() => patch({ mode: "keyword" })}
            className={`px-4 py-2 text-sm transition-colors ${
              mode === "keyword"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            关键词搜索
          </button>
          <button
            type="button"
            onClick={() => patch({ mode: "account" })}
            className={`px-4 py-2 text-sm transition-colors border-l ${
              mode === "account"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            按账号抓取
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "keyword"
            ? "用关键词搜索 5 平台(抖音/微博/小红书/视频号/知乎)的公开内容"
            : "按媒体字典里录入的账号 ID 拉取该账号的最新发布(4 平台:抖音/微博/快手/公众号)"}
        </p>
      </div>

      {mode === "keyword" ? (
        <>
          <div className="space-y-1.5">
            <Label>平台 *</Label>
            <Select
              value={(config.platform as string) ?? ""}
              onValueChange={(v) => patch({ platform: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="请选择" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="douyin">抖音</SelectItem>
                <SelectItem value="weibo">微博</SelectItem>
                <SelectItem value="xiaohongshu">小红书</SelectItem>
                <SelectItem value="wechat_channels">微信视频号</SelectItem>
                <SelectItem value="zhihu">知乎</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>关键词 *</Label>
            <Textarea
              value={
                Array.isArray(config.keywords)
                  ? (config.keywords as string[]).join("\n")
                  : ""
              }
              onChange={(e) =>
                patch({
                  keywords: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={4}
              placeholder="一行一个关键词,1-20 个"
            />
          </div>
          <div className="space-y-1.5">
            <Label>时间窗</Label>
            <Select
              value={(config.timeWindow as string) ?? "halfYear"}
              onValueChange={(v) => patch({ timeWindow: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">一天内</SelectItem>
                <SelectItem value="week">一周内</SelectItem>
                <SelectItem value="halfYear">半年内</SelectItem>
                <SelectItem value="all">全部(如平台支持)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>平台 * <span className="text-xs font-normal text-muted-foreground">(可多选)</span></Label>
              {accountPlatforms.length > 0 && (
                <span className="text-xs text-muted-foreground">已选 {accountPlatforms.length} 个</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {TIKHUB_ACCOUNT_PLATFORMS.map((p) => {
                const on = accountPlatforms.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => toggleAccountPlatform(p.value)}
                    className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                      on
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>选择媒体 * <span className="text-xs font-normal text-muted-foreground">(可多选,需在已选平台至少配过一个账号)</span></Label>
              {outletIds.length > 0 && (
                <span className="text-xs text-muted-foreground">已选 {outletIds.length} 个</span>
              )}
            </div>
            {accountPlatforms.length === 0 ? (
              <div className="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                请先勾选平台
              </div>
            ) : eligibleOutlets.length === 0 ? (
              <div className="rounded-md border border-dashed bg-amber-50 dark:bg-amber-950/30 px-3 py-4 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ 没有任何媒体在已选平台配置过账号。请去{" "}
                <Link href="/data-collection/outlets" className="underline">
                  媒体字典
                </Link>{" "}
                补全后再回来。
              </div>
            ) : (
              <OutletMultiPicker
                eligibleOutlets={eligibleOutlets}
                accountPlatforms={accountPlatforms}
                selected={outletIds}
                onToggle={toggleOutletId}
                onSelectAll={() => patch({ outletIds: eligibleOutlets.map((o) => o.id) })}
                onClear={() => patch({ outletIds: [] })}
              />
            )}
          </div>
        </>
      )}

      {/* 共享字段 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>每次最大页数</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={(config.maxPagesPerRun as number | undefined) ?? ""}
            onChange={(e) =>
              patch({ maxPagesPerRun: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>每页条数</Label>
          <Input
            type="number"
            min={10}
            max={50}
            value={(config.resultsPerPage as number | undefined) ?? ""}
            onChange={(e) =>
              patch({ resultsPerPage: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>月预算 USD</Label>
          <Input
            type="number"
            min={0}
            step={0.1}
            value={(config.monthlyBudgetUsd as number | undefined) ?? ""}
            onChange={(e) =>
              patch({ monthlyBudgetUsd: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </div>
      </div>
    </div>
  );
}
