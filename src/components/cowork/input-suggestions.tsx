"use client";

import { Button } from "@/components/ui/button";
import type { InputSuggestion } from "@/lib/cowork/input-suggestions";

/**
 * 输入框上方的语义建议 chip 行。点击把 fill 填入输入框（不直接发送，避免误触）。
 */
export function InputSuggestions({
  items,
  onPick,
}: {
  items: InputSuggestion[];
  onPick: (fill: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2 flex gap-2 overflow-x-auto pb-0.5">
      {items.map((s) => (
        <Button
          key={s.label}
          variant="secondary"
          size="sm"
          className="h-7 flex-none whitespace-nowrap rounded-full px-3 text-xs font-normal text-muted-foreground"
          onClick={() => onPick(s.fill)}
        >
          {s.label}
        </Button>
      ))}
    </div>
  );
}
