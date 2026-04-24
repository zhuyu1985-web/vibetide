"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  /** Stable identifier used for sorting + React keys */
  key: string;
  /** Header label (ReactNode allows icons or badges) */
  header: ReactNode;
  /**
   * Column width:
   *  - `"flex"` (default): takes remaining space via `flex-1`
   *  - CSS length like `"120px"` | `"10rem"`: fixed width
   *  - Tailwind width class like `"w-32"`: fixed Tailwind width
   */
  width?: string;
  /** Text alignment inside both header + body cells */
  align?: "left" | "right" | "center";
  /** Enables a clickable sort button on the header cell */
  sortable?: boolean;
  /** Body-cell renderer */
  render: (row: T) => ReactNode;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Extract a unique stable key from each row */
  rowKey: (row: T) => string;

  /** Shown when rows is empty */
  emptyMessage?: ReactNode;

  /** Whole-row click handler */
  onRowClick?: (row: T) => void;

  /** Selection (controlled) */
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;

  /** Sorting (controlled) */
  sortKey?: string | null;
  sortDirection?: "asc" | "desc" | null;
  onSortChange?: (key: string, direction: "asc" | "desc") => void;

  /** Expandable rows (controlled) */
  expandedKeys?: Set<string>;
  onExpandChange?: (keys: Set<string>) => void;
  renderExpanded?: (row: T) => ReactNode;

  /** Optional footer rendered inside the panel below all rows */
  footer?: ReactNode;

  /**
   * 外层是否显示透明玻璃边框（默认 true）。
   * 内置一层 `glass-card` frame 包住核心 panel，所有 DataTable 视觉统一。
   * 在已经外包了 GlassCard 的调用方或嵌入 Tab 面板内想省空间时，可 framed={false}。
   */
  framed?: boolean;

  className?: string;
};

/**
 * Canonical data-table primitive for Vibetide.
 *
 * All dashboard tables should use this component — never hand-roll flex or
 * grid rows with ad-hoc borders / padding / fonts. That is what drifts.
 *
 * Layout: `GlassCard variant="panel"` shell + flex-based header/body rows +
 * canonical spacing (`px-5 py-2.5` header, `px-5 py-4` body), border colors,
 * hover state, and header font (`text-sm font-semibold text-gray-600`).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "暂无数据",
  onRowClick,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  sortKey,
  sortDirection,
  onSortChange,
  expandedKeys,
  onExpandChange,
  renderExpanded,
  footer,
  framed = true,
  className,
}: DataTableProps<T>) {
  // Row expansion is controlled by `renderExpanded` + `expandedKeys`.
  // Chevron column and row-click-to-expand only engage when `onExpandChange`
  // is also provided. Otherwise expansion is driven externally (e.g. by an
  // action button inside a cell) and the parent manages `expandedKeys`.
  const hasExpansion = Boolean(renderExpanded);
  const chevronEnabled = Boolean(renderExpanded && onExpandChange);

  // Select-all state
  const rowKeys = rows.map((r) => rowKey(r));
  const allSelected =
    selectable && rowKeys.length > 0 && rowKeys.every((k) => selectedKeys?.has(k));
  const someSelected =
    selectable && rowKeys.some((k) => selectedKeys?.has(k)) && !allSelected;

  function toggleSelectAll() {
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys ?? []);
    if (allSelected) {
      rowKeys.forEach((k) => next.delete(k));
    } else {
      rowKeys.forEach((k) => next.add(k));
    }
    onSelectionChange(next);
  }

  function toggleSelectRow(k: string) {
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys ?? []);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelectionChange(next);
  }

  function toggleExpand(k: string) {
    if (!onExpandChange) return;
    const next = new Set(expandedKeys ?? []);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onExpandChange(next);
  }

  function handleSortClick(col: DataTableColumn<T>) {
    if (!col.sortable || !onSortChange) return;
    const isActive = sortKey === col.key;
    const nextDir: "asc" | "desc" =
      isActive && sortDirection === "asc" ? "desc" : "asc";
    onSortChange(col.key, nextDir);
  }

  const panel = (
    <GlassCard variant="panel" padding="none" className={framed ? undefined : className}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-200/60 dark:border-gray-700/40">
        {chevronEnabled && <div className="w-4 shrink-0" />}
        {selectable && (
          <div className="w-6 shrink-0 flex items-center">
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleSelectAll}
              aria-label="全选"
            />
          </div>
        )}
        {columns.map((col) => {
          const isActive = sortKey === col.key;
          return (
            <div
              key={col.key}
              className={cn(
                "text-sm font-semibold text-gray-600 dark:text-gray-400",
                colClassName(col),
                col.align === "right" && "text-right",
                col.align === "center" && "text-center",
              )}
              style={colStyle(col)}
            >
              {col.sortable ? (
                <button
                  type="button"
                  onClick={() => handleSortClick(col)}
                  className={cn(
                    "inline-flex items-center gap-1 bg-transparent cursor-pointer hover:text-gray-800 dark:hover:text-gray-200 transition-colors",
                    col.align === "right" && "justify-end w-full",
                    col.align === "center" && "justify-center w-full",
                  )}
                >
                  {col.header}
                  {isActive && sortDirection === "asc" ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : isActive && sortDirection === "desc" ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  )}
                </button>
              ) : (
                col.header
              )}
            </div>
          );
        })}
      </div>

      {/* Body */}
      {rows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
          {emptyMessage}
        </div>
      ) : (
        rows.map((row) => {
          const k = rowKey(row);
          const isExpanded = hasExpansion && expandedKeys?.has(k);
          const isSelected = selectable && selectedKeys?.has(k);
          const clickable = Boolean(onRowClick) || chevronEnabled;
          return (
            <div
              key={k}
              className={cn(
                "border-b border-gray-100/60 dark:border-gray-800/40 last:border-b-0",
                isExpanded && "bg-gray-50/50 dark:bg-gray-800/20",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-3 px-5 py-4 transition-colors",
                  clickable && "cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/20",
                  !clickable && "hover:bg-gray-50/50 dark:hover:bg-gray-800/20",
                  isSelected && "bg-sky-50/40 dark:bg-sky-900/10",
                )}
                onClick={
                  clickable
                    ? () => {
                        if (onRowClick) onRowClick(row);
                        else if (chevronEnabled) toggleExpand(k);
                      }
                    : undefined
                }
              >
                {chevronEnabled && (
                  <div className="w-4 shrink-0 flex items-center justify-center">
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 text-gray-400 transition-transform",
                        isExpanded && "rotate-90",
                      )}
                    />
                  </div>
                )}
                {selectable && (
                  <div
                    className="w-6 shrink-0 flex items-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectRow(k)}
                      aria-label="选择行"
                    />
                  </div>
                )}
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={cn(
                      "text-sm text-gray-800 dark:text-gray-200 min-w-0",
                      colClassName(col),
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                    )}
                    style={colStyle(col)}
                  >
                    {col.render(row)}
                  </div>
                ))}
              </div>

              {isExpanded && renderExpanded && (
                <div className="px-5 pb-4" onClick={(e) => e.stopPropagation()}>
                  {renderExpanded(row)}
                </div>
              )}
            </div>
          );
        })
      )}

      {footer && (
        <div className="border-t border-gray-200/60 dark:border-gray-700/40 px-5 py-3">
          {footer}
        </div>
      )}
    </GlassCard>
  );

  if (!framed) return panel;

  // 统一玻璃边框外层（与 /topic-compare 原视觉一致）
  return (
    <div className={cn("glass-card p-5", className)}>{panel}</div>
  );
}

function colStyle<T>(col: DataTableColumn<T>): React.CSSProperties | undefined {
  const w = col.width ?? "flex";
  if (w === "flex") return { flex: 1, minWidth: 0 };
  if (w.startsWith("w-")) return { flexShrink: 0 };
  return { width: w, flexShrink: 0 };
}

function colClassName<T>(col: DataTableColumn<T>): string | undefined {
  const w = col.width;
  return w && w.startsWith("w-") ? w : undefined;
}
