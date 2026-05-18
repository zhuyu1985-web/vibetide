"use client";

/**
 * A6 Phase 5 — `@` mention autocomplete picker
 *
 * 用户在 chat input 输入 `@` 时弹出此 popover，列出全部 employee（lucide icon + bgColor + nickname + slug）。
 * 点选后回调 `onSelect(slug)`，由父组件负责把 `@<slug> ` 插入 input 并触发 backend 切换。
 *
 * 当前 Phase 5 仅交付组件本身，未挂到任何 chat input（项目内现有 chat input 在
 * `articles/[id]/features/ai-chat/chat-input.tsx` 是文章详情场景的局部 chat，全局 chat-center 输入入口
 * 仍在迭代中）。挂载工作留作 Phase 5 follow-up。
 *
 * 设计原则：
 * - 无边框按钮（CLAUDE.md 设计系统）
 * - 中文 UI
 * - lucide icon + bgColor 与 EMPLOYEE_META 单一来源对齐（新增第 N 位员工自动出现在列表）
 *
 * 参见：docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md §5.3
 */

import { Button } from "@/components/ui/button";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";

interface EmployeeMentionPickerProps {
  /** 是否展开（由父组件根据用户输入是否在 `@` 触发态控制） */
  open: boolean;
  /** `@` 后用户已输入的字符（用于前缀过滤）；空字符串表示刚敲完 `@` */
  filter: string;
  /** 选中员工后的回调；插入 `@<slug> ` 到 input 由父组件实现 */
  onSelect: (slug: EmployeeId) => void;
}

export function EmployeeMentionPicker({
  open,
  filter,
  onSelect,
}: EmployeeMentionPickerProps) {
  if (!open) return null;

  const normalized = filter.toLowerCase();
  const employees = (Object.keys(EMPLOYEE_META) as EmployeeId[]).filter(
    (slug) => slug.startsWith(normalized)
  );

  if (employees.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 z-50 mb-2 h-60 w-64 overflow-y-auto rounded-md bg-popover shadow-lg"
      role="listbox"
      aria-label="选择 AI 员工"
    >
      {employees.map((slug) => {
        const meta = EMPLOYEE_META[slug];
        const Icon = meta.icon;
        return (
          <Button
            key={slug}
            type="button"
            variant="ghost"
            onClick={() => onSelect(slug)}
            className="flex h-auto w-full justify-start gap-2 rounded-none px-3 py-2 text-sm font-normal"
            role="option"
            aria-selected={false}
            aria-label={`@${slug} ${meta.nickname}`}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: meta.bgColor }}
            >
              <Icon size={14} style={{ color: meta.color }} />
            </span>
            <span className="font-medium">@{slug}</span>
            <span className="truncate text-xs text-muted-foreground">
              {meta.nickname}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
