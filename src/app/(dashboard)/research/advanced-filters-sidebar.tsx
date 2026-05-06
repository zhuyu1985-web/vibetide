"use client";

import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-picker";
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_VALUES,
  OUTLET_TIER_LABELS,
  OUTLET_TIER_VALUES,
} from "@/lib/collection/constants";
import type { SidebarFilter } from "./search-mode-types";

interface Props {
  filter: SidebarFilter;
  onChange: (filter: SidebarFilter) => void;
  options: {
    districts: { id: string; name: string }[];
    topics: { id: string; name: string }[];
  };
}

export function AdvancedFiltersSidebar({ filter, onChange, options }: Props) {
  function toggle<T extends string>(arr: T[] | undefined, v: T): T[] {
    const set = new Set(arr ?? []);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    return Array.from(set);
  }

  const hasAny =
    (filter.outletTiers?.length ?? 0) > 0 ||
    (filter.districtIds?.length ?? 0) > 0 ||
    (filter.topicIds?.length ?? 0) > 0 ||
    (filter.contentTypes?.length ?? 0) > 0 ||
    Boolean(filter.publishedAtRange);

  return (
    <aside className="w-64 space-y-4 border-l border-gray-200 dark:border-white/5 pl-4">
      <h3 className="text-sm font-medium">侧栏过滤器</h3>

      <FilterSection label="媒体分级">
        <div className="flex flex-wrap gap-1">
          {OUTLET_TIER_VALUES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={filter.outletTiers?.includes(t) ? "default" : "ghost"}
              onClick={() =>
                onChange({ ...filter, outletTiers: toggle(filter.outletTiers, t) })
              }
            >
              {OUTLET_TIER_LABELS[t]}
            </Button>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="区县">
        <Select
          value=""
          onValueChange={(v) =>
            onChange({ ...filter, districtIds: toggle(filter.districtIds, v) })
          }
        >
          <SelectTrigger>
            <SelectValue
              placeholder={`已选 ${filter.districtIds?.length ?? 0} 个`}
            />
          </SelectTrigger>
          <SelectContent>
            {options.districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {filter.districtIds?.includes(d.id) ? "✓ " : ""}
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection label="主题">
        <Select
          value=""
          onValueChange={(v) =>
            onChange({ ...filter, topicIds: toggle(filter.topicIds, v) })
          }
        >
          <SelectTrigger>
            <SelectValue
              placeholder={`已选 ${filter.topicIds?.length ?? 0} 个`}
            />
          </SelectTrigger>
          <SelectContent>
            {options.topics.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {filter.topicIds?.includes(t.id) ? "✓ " : ""}
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection label="时间范围">
        <DateRangePicker
          value={
            filter.publishedAtRange
              ? {
                  from: new Date(filter.publishedAtRange.from),
                  to: new Date(filter.publishedAtRange.to),
                }
              : undefined
          }
          onChange={(r) => {
            // DateRange.to 可选 — 必须两端都选齐才落 publishedAtRange
            if (r?.from && r?.to) {
              onChange({
                ...filter,
                publishedAtRange: {
                  from: r.from.toISOString(),
                  to: r.to.toISOString(),
                },
              });
            } else {
              onChange({ ...filter, publishedAtRange: undefined });
            }
          }}
        />
      </FilterSection>

      <FilterSection label="内容类型">
        <div className="flex flex-wrap gap-1">
          {CONTENT_TYPE_VALUES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={filter.contentTypes?.includes(t) ? "default" : "ghost"}
              onClick={() =>
                onChange({
                  ...filter,
                  contentTypes: toggle(filter.contentTypes, t),
                })
              }
            >
              {CONTENT_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </FilterSection>

      {hasAny ? (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          清空过滤器
        </Button>
      ) : null}
    </aside>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
