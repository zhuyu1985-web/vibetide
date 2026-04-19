"use client";

import * as React from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ── Shared trigger ────────────────────────────────────────────────────────
//
// A date-picker trigger is a form input, not a primary action button, so it
// should visually match `<Input>` (bordered, muted, full-width where the
// consumer says so). Copy the Input class list here so the trigger stays in
// sync without us having to import Input's class string directly.

const triggerClass = cn(
  "border-input data-[placeholder]:text-muted-foreground aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 inline-flex h-9 min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
);

// ── Single-date picker ────────────────────────────────────────────────────

interface DatePickerProps {
  value?: Date | null;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "选择日期",
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            triggerClass,
            "w-[160px]",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-50 shrink-0" />
          <span className="flex-1 text-left truncate">
            {value ? format(value, "yyyy-MM-dd", { locale: zhCN }) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(day) => {
            onChange?.(day);
            setOpen(false);
          }}
          locale={zhCN}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Date-range picker ─────────────────────────────────────────────────────

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "选择日期范围",
  className,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const formatted = value?.from
    ? value.to
      ? `${format(value.from, "yyyy-MM-dd", { locale: zhCN })} ~ ${format(value.to, "yyyy-MM-dd", { locale: zhCN })}`
      : format(value.from, "yyyy-MM-dd", { locale: zhCN })
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            triggerClass,
            "w-[260px]",
            !formatted && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-50 shrink-0" />
          <span className="flex-1 text-left truncate">
            {formatted ?? placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => {
            onChange?.(range);
            if (range?.from && range.to) setOpen(false);
          }}
          locale={zhCN}
          numberOfMonths={2}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
