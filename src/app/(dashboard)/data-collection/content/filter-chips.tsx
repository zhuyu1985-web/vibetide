"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  label: string;
  options: ChipOption[];
  value: string | undefined;
  /** 传 undefined 表示取消选择(等同点回"全部")。 */
  onChange: (v: string | undefined) => void;
  /** 是否始终包含一个"全部"虚拟 chip(value="__all__"),点它清空选择。默认 true。 */
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
}

/**
 * 信息来源 / 媒体维度 之类的横排 toggleable chip 组。
 * 单选;再次点击已选项 = 清空(同 includeAll 的"全部" chip)。
 *
 * 采用 <Button variant="ghost" size="xs"> 当 base — 跟项目"按钮无边框"规则一致,
 * 已选状态用 bg-primary/15 + text-primary 高亮。
 */
export function FilterChips({
  label,
  options,
  value,
  onChange,
  includeAll = true,
  allLabel = "全部",
  className,
}: FilterChipsProps) {
  const isAllActive = value === undefined || value === "";
  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      <span className="text-xs text-muted-foreground shrink-0 mr-1">{label}</span>
      {includeAll && (
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onChange(undefined)}
          className={cn(
            "text-xs font-normal",
            isAllActive && "bg-primary/15 text-primary font-medium hover:bg-primary/20",
          )}
        >
          {allLabel}
        </Button>
      )}
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="xs"
            onClick={() => onChange(active ? undefined : opt.value)}
            className={cn(
              "text-xs font-normal",
              active && "bg-primary/15 text-primary font-medium hover:bg-primary/20",
            )}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span className="ml-0.5 text-[10px] opacity-60 tabular-nums">
                ({opt.count.toLocaleString()})
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
