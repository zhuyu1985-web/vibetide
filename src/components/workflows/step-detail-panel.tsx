"use client";

import { useMemo, useState } from "react";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { InputFieldDef } from "@/lib/types";
import { ChevronDown, Info, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ToolParamSpec 类型从 tool-registry 复刻过来 —— 不能直接 import 因为那文件
// 拖着 db / drizzle 等 server-only 依赖，会把服务端模块泄漏进客户端 bundle。
// 实际的 specs 由 server page 预计算，通过 props 透传到这里。
export interface ToolParamSpec {
  name: string;
  description?: string;
  required: boolean;
  type: string;
  enumValues?: readonly string[];
  defaultValue?: unknown;
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SKILL_CATEGORY_CONFIG } from "./step-card";
import type { WorkflowPickerSkill } from "@/lib/dal/skills";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepDetailPanelProps {
  step: WorkflowStepDef;
  /** Live skills pool — used to render the "当前技能" info popup. */
  skills?: WorkflowPickerSkill[];
  /**
   * Workflow-level input fields. Used to populate the parameter-binding
   * dropdown so users can pick a field (e.g. "事件主题（topic_title）") instead
   * of hand-typing `{{topic_title}}`.
   */
  inputFields?: InputFieldDef[];
  /**
   * Server-pre-computed tool parameter specs keyed by skillSlug.
   * Used to drive the "参数名" dropdown so users can pick from each tool's
   * actual input schema (e.g. web_search: query / timeRange / maxResults ...)
   * instead of guessing what to type.
   */
  toolParamSpecs?: Record<string, ToolParamSpec[]>;
  onSave: (updated: WorkflowStepDef) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepDetailPanel({
  step,
  skills,
  inputFields = [],
  toolParamSpecs = {},
  onSave,
  onClose,
}: StepDetailPanelProps) {
  // 针对当前步骤的 skill 查找参数 spec；没有就退化到"手输参数名"。
  const currentToolParams = useMemo<ToolParamSpec[]>(() => {
    const slug = step.config?.skillSlug;
    if (!slug) return [];
    return toolParamSpecs[slug] ?? [];
  }, [step.config?.skillSlug, toolParamSpecs]);
  const catConfig = step.config?.skillCategory
    ? SKILL_CATEGORY_CONFIG[step.config.skillCategory]
    : null;

  const description = step.config?.description ?? "";

  // Look up the live skill record (for description/version) by slug.
  const currentSkill = step.config?.skillSlug
    ? skills?.find((s) => s.slug === step.config?.skillSlug) ?? null
    : null;

  const [skillInfoOpen, setSkillInfoOpen] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground">
          步骤 {step.order}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Step name */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="detail-step-name">步骤名称</Label>
          <Input
            id="detail-step-name"
            value={step.name}
            onChange={(e) =>
              onSave({
                ...step,
                name: e.target.value,
                config: {
                  ...step.config,
                  parameters: step.config?.parameters ?? {},
                },
              })
            }
            placeholder="输入步骤名称"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="detail-step-desc">步骤说明</Label>
          <Textarea
            id="detail-step-desc"
            value={description}
            onChange={(e) =>
              onSave({
                ...step,
                config: {
                  ...step.config,
                  parameters: step.config?.parameters ?? {},
                  description: e.target.value || undefined,
                },
              })
            }
            placeholder="例如：撰写面向科技读者的 1500 字深度评论，结构为'现象-数据-观点-展望'"
            className="min-h-[80px] resize-none"
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            告诉 AI 这一步具体要做什么、有哪些约束（受众、字数、风格、渠道等）。说明越具体，测试/执行结果越贴合预期。
          </p>
        </div>

        {/* Current skill display — click opens an info dialog */}
        {step.type === "skill" && step.config?.skillName && (
          <div className="flex flex-col gap-2">
            <Label>当前技能</Label>
            <button
              type="button"
              onClick={() => currentSkill && setSkillInfoOpen(true)}
              disabled={!currentSkill}
              title={currentSkill ? "查看技能简介" : "技能未在技能库中登记"}
              className="group flex items-center gap-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 border-0 text-left transition-colors hover:bg-black/[0.06] dark:hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
            >
              {catConfig && (
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                  style={{ backgroundColor: catConfig.bgColor }}
                >
                  <catConfig.icon
                    className="w-3.5 h-3.5"
                    style={{ color: catConfig.color }}
                  />
                </div>
              )}
              <span className="text-sm text-foreground flex-1 truncate">
                {step.config.skillName}
              </span>
              {catConfig && (
                <span
                  className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: catConfig.bgColor,
                    color: catConfig.color,
                  }}
                >
                  {catConfig.label}
                </span>
              )}
              {currentSkill && (
                <Info className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 transition-opacity opacity-0 group-hover:opacity-100" />
              )}
            </button>
            <button
              onClick={() => {
                // placeholder: would open skill selector
              }}
              className="self-start px-3 py-1.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] text-xs text-muted-foreground hover:text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-colors cursor-pointer"
            >
              更换技能
            </button>

            <Dialog open={skillInfoOpen} onOpenChange={setSkillInfoOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {catConfig && (
                      <div
                        className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                        style={{ backgroundColor: catConfig.bgColor }}
                      >
                        <catConfig.icon
                          className="w-3.5 h-3.5"
                          style={{ color: catConfig.color }}
                        />
                      </div>
                    )}
                    <span className="truncate">
                      {currentSkill?.name ?? step.config.skillName}
                    </span>
                    {catConfig && (
                      <span
                        className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          backgroundColor: catConfig.bgColor,
                          color: catConfig.color,
                        }}
                      >
                        {catConfig.label}
                      </span>
                    )}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    技能基本信息
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      slug：<code className="font-mono">{currentSkill?.slug}</code>
                    </span>
                    {currentSkill?.version && (
                      <span>版本 v{currentSkill.version}</span>
                    )}
                    {currentSkill?.type && (
                      <span>类型：{currentSkill.type}</span>
                    )}
                  </div>
                  {currentSkill?.description ? (
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {currentSkill.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      该技能暂无描述。
                    </p>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Output action display */}
        {step.type === "output" && step.config?.outputAction && (
          <div className="flex flex-col gap-2">
            <Label>输出动作</Label>
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
              <span className="text-sm text-foreground">
                {step.config.outputAction}
              </span>
            </div>
          </div>
        )}

        {/* ── 参数配置 ──
            用于把工作流启动时用户填写的输入字段（inputFields）绑定到本步骤
            调用工具/技能时的参数。值支持 Mustache 占位符 {{fieldName}}：
            运行时会用 mission.inputParams 里的真实值替换，并作为【调用参数】
            块追加到 task 指令里。这是避免 LLM 凭上下文"自己选参数"导致搜错
            关键词（例如用户输入 CCBN，LLM 却搜"AI 行业热点"）的核心机制。 */}
        {step.type === "skill" && (
          <ParameterBindingsEditor
            value={(step.config?.parameters ?? {}) as Record<string, string>}
            inputFields={inputFields}
            toolParams={currentToolParams}
            onChange={(nextParams) =>
              onSave({
                ...step,
                config: {
                  ...step.config,
                  parameters: nextParams,
                },
              })
            }
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParameterBindingsEditor —— 步骤参数绑定编辑器
//
// 把用户输入的 inputFields（通过 {{fieldName}} 占位符）绑定到本步骤调用工具
// 的参数上。运行时 mission-executor 会用 mission.inputParams 渲染这些值并
// 强制要求 LLM 使用这些参数调用工具 —— 避免 LLM "自行理解上下文选参数"
// 带来的幻觉（如搜 "CCBN" 变成搜 "AI 行业热点"）。
//
// 典型用例：
//   query      = {{topic_title}}     → 运行时变成 query: "CCBN"
//   maxResults = 2                    → 字面量 2
//   timeRange  = 24h                  → 字面量 "24h"
// ---------------------------------------------------------------------------
interface ParameterBindingRow {
  id: string;
  key: string;
  value: string;
}

function toRows(record: Record<string, string>): ParameterBindingRow[] {
  return Object.entries(record).map(([key, value]) => ({
    id: `${key}-${Math.random().toString(36).slice(2, 7)}`,
    key,
    value: String(value ?? ""),
  }));
}

function toRecord(rows: ParameterBindingRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (!row.key.trim()) continue;
    out[row.key.trim()] = row.value;
  }
  return out;
}

function ParameterBindingsEditor({
  value,
  inputFields,
  toolParams,
  onChange,
}: {
  value: Record<string, string>;
  inputFields: InputFieldDef[];
  toolParams: ToolParamSpec[];
  onChange: (next: Record<string, string>) => void;
}) {
  // 用本地 rows 维护是因为 Record 的键顺序在 React state 里不可靠；而且空 key
  // 不应该立刻写进 value 避免干扰。
  const [rows, setRows] = useState<ParameterBindingRow[]>(() => toRows(value));

  function commit(nextRows: ParameterBindingRow[]) {
    setRows(nextRows);
    onChange(toRecord(nextRows));
  }

  function patchRow(id: string, patch: Partial<ParameterBindingRow>) {
    commit(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    commit(rows.filter((r) => r.id !== id));
  }

  function addRow() {
    commit([
      ...rows,
      {
        id: `new-${Math.random().toString(36).slice(2, 7)}`,
        key: "",
        value: "",
      },
    ]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>参数配置</Label>
        <Button size="sm" variant="ghost" onClick={addRow}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          添加参数
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-4 text-center">
          <span className="text-xs text-muted-foreground">
            未配置参数 —— LLM 会自行从上下文推断，可能出错
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            // 已被同一行之外占用过的 key，避免同行选到同一参数名
            const usedKeys = new Set(
              rows.filter((r) => r.id !== row.id && r.key).map((r) => r.key),
            );
            return (
              <div key={row.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <ParameterNamePicker
                    value={row.key}
                    toolParams={toolParams}
                    usedKeys={usedKeys}
                    onChange={(v) => patchRow(row.id, { key: v })}
                  />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">=</span>
                <div className="flex-[1.5]">
                  <ParameterValuePicker
                    value={row.value}
                    inputFields={inputFields}
                    onChange={(v) => patchRow(row.id, { value: v })}
                  />
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeRow(row.id)}
                  className="h-8 w-8 shrink-0"
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground leading-relaxed">
        参数名从技能支持的参数里挑；值可绑定启动表单字段（运行时自动取值），或填字面量。例：query 绑定到 topic_title，timeRange 填字面量 7d。
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ParameterNamePicker —— 参数名选择器（基于当前 skill 的 inputSchema）
// ---------------------------------------------------------------------------
function ParameterNamePicker({
  value,
  toolParams,
  usedKeys,
  onChange,
}: {
  value: string;
  toolParams: ToolParamSpec[];
  usedKeys: Set<string>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentSpec = toolParams.find((p) => p.name === value);

  // 若 toolParams 为空（技能未在 ALL_TOOLS 注册、或 inputSchema 失败解析），
  // 退化为手输 —— 总比卡死用户强。
  if (toolParams.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="参数名（手动输入）"
      />
    );
  }

  const displayLabel = (() => {
    if (currentSpec) {
      return (
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="truncate font-mono">{currentSpec.name}</span>
          {currentSpec.required && (
            <span className="shrink-0 text-[10px] text-red-500">必填</span>
          )}
        </span>
      );
    }
    if (value) {
      // 用户选过但之后工具改了（schema 里不再有该参数）
      return (
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            未知参数
          </span>
          <span className="truncate font-mono">{value}</span>
        </span>
      );
    }
    return <span className="text-muted-foreground">选择参数...</span>;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
        >
          {displayLabel}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-[320px] p-1">
        <div className="px-2 pt-1 pb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          技能支持的参数
        </div>
        <div className="max-h-[320px] overflow-y-auto space-y-0.5">
          {toolParams.map((p) => {
            const active = p.name === value;
            const disabled = !active && usedKeys.has(p.name);
            return (
              <button
                key={p.name}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  onChange(p.name);
                  setOpen(false);
                }}
                className={`w-full flex flex-col items-start gap-0.5 rounded-md border-0 px-2 py-2 text-left transition-colors ${
                  active
                    ? "bg-blue-50 dark:bg-blue-500/15"
                    : disabled
                      ? "bg-transparent opacity-40 cursor-not-allowed"
                      : "bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
                }`}
              >
                <div className="flex items-center gap-1.5 w-full">
                  <span
                    className={`font-mono text-sm ${
                      active
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-foreground"
                    }`}
                  >
                    {p.name}
                  </span>
                  {p.required && (
                    <span className="text-[10px] text-red-500">必填</span>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground uppercase">
                    {p.type}
                  </span>
                  {disabled && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      已占用
                    </span>
                  )}
                </div>
                {p.description && (
                  <span className="text-xs text-muted-foreground line-clamp-2 leading-snug">
                    {p.description}
                  </span>
                )}
                {p.enumValues && p.enumValues.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    可选值：{p.enumValues.join(" / ")}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// ParameterValuePicker —— 值选择器：下拉选字段 or 填字面量
// ---------------------------------------------------------------------------
const MUSTACHE_PATTERN = /^\{\{(\w+)\}\}$/;

function ParameterValuePicker({
  value,
  inputFields,
  onChange,
}: {
  value: string;
  inputFields: InputFieldDef[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  // 判断当前 value 是 field 绑定还是字面量
  const match = MUSTACHE_PATTERN.exec(value);
  const boundField = match
    ? inputFields.find((f) => f.name === match[1])
    : null;

  // 显示文案：绑定字段显示中文标签 + 英文 name；字面量显示值本身；空则提示
  const displayLabel = (() => {
    if (match) {
      if (boundField) {
        return (
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 rounded bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
              字段
            </span>
            <span className="truncate">
              {boundField.label || boundField.name}
            </span>
          </span>
        );
      }
      return (
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 rounded bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            未知字段
          </span>
          <span className="truncate">{match[1]}</span>
        </span>
      );
    }
    if (value) {
      return (
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 rounded bg-gray-100 dark:bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400">
            值
          </span>
          <span className="truncate">{value}</span>
        </span>
      );
    }
    return <span className="text-muted-foreground">选择字段或输入值</span>;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm outline-none transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
        >
          {displayLabel}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[280px] p-2 space-y-2"
      >
        {/* 字段绑定区 */}
        <div>
          <div className="px-1 pb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            绑定启动表单输入字段
          </div>
          {inputFields.length === 0 ? (
            <p className="rounded-md bg-black/[0.03] dark:bg-white/[0.04] p-2 text-xs text-muted-foreground">
              工作流还没配置输入字段，先到左侧「输入字段」区添加再来绑定。
            </p>
          ) : (
            <div className="space-y-0.5">
              {inputFields.map((f, idx) => {
                const active = match?.[1] === f.name;
                const hasName = (f.name ?? "").trim().length > 0;
                // name 为空的字段无法绑定 —— Mustache `{{}}` 会渲染成空串
                if (!hasName) {
                  return (
                    <div
                      key={`unnamed-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-md bg-amber-50/50 dark:bg-amber-500/[0.08] px-2 py-1.5 text-left text-sm"
                    >
                      <span className="flex-1 truncate text-amber-700 dark:text-amber-400">
                        {f.label || `字段 #${idx + 1}`}（未填字段名）
                      </span>
                      <span className="shrink-0 text-[10px] text-amber-600 dark:text-amber-400">
                        需补字段名
                      </span>
                    </div>
                  );
                }
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => {
                      onChange(`{{${f.name}}}`);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-md border-0 px-2 py-1.5 text-left text-sm transition-colors cursor-pointer ${
                      active
                        ? "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300"
                        : "bg-transparent hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="flex-1 truncate">
                      {f.label || f.name}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {f.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 字面量区 */}
        <div className="border-t border-border pt-2">
          <div className="px-1 pb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            或输入字面量
          </div>
          <Input
            value={match ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="如 24h、2、zh-CN"
            className="h-8"
          />
        </div>

        {/* 清空按钮 */}
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="w-full rounded-md border-0 bg-transparent px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            清空
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
