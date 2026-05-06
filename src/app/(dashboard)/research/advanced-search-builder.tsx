"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-picker";
import { Plus, X } from "lucide-react";
import {
  type AdvancedSearchCondition,
  type AdvancedSearchField,
  type AdvancedSearchOperator,
  FIELD_LABELS,
  FIELD_OPERATORS,
  OPERATOR_LABELS,
} from "./search-mode-types";

export interface BuilderOptions {
  outletTiers: { value: string; label: string }[];
  outletRegions: string[];
  districts: { id: string; name: string }[];
  topics: { id: string; name: string }[];
  contentTypes: { value: string; label: string }[];
  platforms: string[];
}

interface Props {
  conditions: AdvancedSearchCondition[];
  onChange: (conditions: AdvancedSearchCondition[]) => void;
  options: BuilderOptions;
}

export function AdvancedSearchBuilder({ conditions, onChange, options }: Props) {
  function updateRow(idx: number, patch: Partial<AdvancedSearchCondition>) {
    const next = conditions.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  }

  function handleFieldChange(idx: number, field: AdvancedSearchField) {
    // 字段切换：自动重置 operator 到第一个可用 + 清空 value/value2/valueRange
    const ops = FIELD_OPERATORS[field];
    updateRow(idx, {
      field,
      operator: ops[0]!,
      value: "",
      value2: undefined,
      valueRange: undefined,
    });
  }

  function addRow() {
    if (conditions.length >= 10) return;
    onChange([
      ...conditions,
      { field: "title", operator: "contains", value: "", logic: "and" },
    ]);
  }

  function removeRow(idx: number) {
    if (conditions.length <= 1) return;
    onChange(conditions.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {conditions.map((row, idx) => (
        <RowEditor
          key={idx}
          row={row}
          isLast={idx === conditions.length - 1}
          options={options}
          onFieldChange={(f) => handleFieldChange(idx, f)}
          onOperatorChange={(o) => updateRow(idx, { operator: o })}
          onValueChange={(v) => updateRow(idx, { value: v })}
          onRangeChange={(r) => updateRow(idx, { valueRange: r })}
          onLogicChange={(l) => updateRow(idx, { logic: l })}
          onRemove={() => removeRow(idx)}
          canRemove={conditions.length > 1}
        />
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={addRow}
        disabled={conditions.length >= 10}
      >
        <Plus className="mr-1 size-4" /> 添加条件（{conditions.length}/10）
      </Button>
    </div>
  );
}

interface RowProps {
  row: AdvancedSearchCondition;
  isLast: boolean;
  options: BuilderOptions;
  onFieldChange: (f: AdvancedSearchField) => void;
  onOperatorChange: (o: AdvancedSearchOperator) => void;
  onValueChange: (v: string) => void;
  onRangeChange: (r: { from: string; to: string } | undefined) => void;
  onLogicChange: (l: "and" | "or") => void;
  onRemove: () => void;
  canRemove: boolean;
}

function RowEditor({
  row,
  isLast,
  options,
  onFieldChange,
  onOperatorChange,
  onValueChange,
  onRangeChange,
  onLogicChange,
  onRemove,
  canRemove,
}: RowProps) {
  return (
    <div className="flex items-center gap-2">
      {/* 字段 Select */}
      <Select
        value={row.field}
        onValueChange={(v) => onFieldChange(v as AdvancedSearchField)}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(FIELD_LABELS) as AdvancedSearchField[]).map((f) => (
            <SelectItem key={f} value={f}>
              {FIELD_LABELS[f]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 操作符 Select */}
      <Select
        value={row.operator}
        onValueChange={(v) => onOperatorChange(v as AdvancedSearchOperator)}
      >
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FIELD_OPERATORS[row.field].map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 值控件（按字段类型条件渲染） */}
      <ValueInput
        row={row}
        options={options}
        onValueChange={onValueChange}
        onRangeChange={onRangeChange}
      />

      {/* AND/OR 切换器（最后一行不显示） */}
      {!isLast ? (
        <Select
          value={row.logic}
          onValueChange={(v) => onLogicChange(v as "and" | "or")}
        >
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">AND</SelectItem>
            <SelectItem value="or">OR</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <div className="w-20" />
      )}

      {/* 删除按钮 */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={!canRemove}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

function ValueInput({
  row,
  options,
  onValueChange,
  onRangeChange,
}: {
  row: AdvancedSearchCondition;
  options: BuilderOptions;
  onValueChange: (v: string) => void;
  onRangeChange: (r: { from: string; to: string } | undefined) => void;
}) {
  switch (row.field) {
    case "title":
    case "content":
    case "author":
    case "outletName":
      return (
        <Input
          className="flex-1"
          placeholder="关键词"
          value={row.value}
          onChange={(e) => onValueChange(e.target.value)}
        />
      );
    case "outletTier":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="选择分级" />
          </SelectTrigger>
          <SelectContent>
            {options.outletTiers.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
            <SelectItem value="unclassified">未分类</SelectItem>
          </SelectContent>
        </Select>
      );
    case "outletRegion":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="选择区域" />
          </SelectTrigger>
          <SelectContent>
            {options.outletRegions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "district":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="选择区县" />
          </SelectTrigger>
          <SelectContent>
            {options.districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "topic":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="选择主题" />
          </SelectTrigger>
          <SelectContent>
            {options.topics.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "contentType":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="选择类型" />
          </SelectTrigger>
          <SelectContent>
            {options.contentTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "platform":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="选择平台" />
          </SelectTrigger>
          <SelectContent>
            {options.platforms.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "publishedAt":
      return (
        <DateRangePicker
          className="flex-1"
          value={
            row.valueRange
              ? {
                  from: new Date(row.valueRange.from),
                  to: new Date(row.valueRange.to),
                }
              : undefined
          }
          onChange={(r) => {
            // DateRange.to 可选 — 仅在两端都选齐才提交 valueRange
            if (r?.from && r?.to) {
              onRangeChange({
                from: r.from.toISOString(),
                to: r.to.toISOString(),
              });
            } else {
              onRangeChange(undefined);
            }
          }}
        />
      );
  }
}
