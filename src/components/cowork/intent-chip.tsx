"use client";

import { Sparkles } from "lucide-react";
import { toIntentChipView } from "@/lib/cowork/intent-chip-view";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import type { IntentResult } from "@/lib/agent/types";

/**
 * 意图识别 chip —— AI 回复顶部展示「意图识别 · 类型 → 派单 员工」。
 * 员工头像走 EmployeeAvatar（内部 resolveEmployeeVisual，工种实例 slug 也能解析）。
 */
export function IntentChip({ intent }: { intent: IntentResult }) {
  const view = toIntentChipView(intent);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
        <Sparkles className="size-3" />
        意图识别 · {view.typeLabel}
        {view.tentative && <span className="opacity-70">· 待确认</span>}
      </span>
      {view.employees.length > 0 && (
        <span className="inline-flex flex-wrap items-center gap-1">
          <span>→ 派单</span>
          {view.employees.slice(0, 3).map((e) => (
            <span
              key={e.slug}
              className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pl-0.5 pr-1.5"
            >
              <EmployeeAvatar employeeId={e.slug} size="xs" />
              <span className="text-foreground">{e.name}</span>
            </span>
          ))}
          {view.employees.length > 3 && (
            <span>等 {view.employees.length} 人</span>
          )}
        </span>
      )}
    </div>
  );
}

/** 从消息 meta 安全取出可渲染的 intent（向后兼容无 intent 的旧消息）。 */
export function readIntentFromMeta(meta: unknown): IntentResult | null {
  if (!meta || typeof meta !== "object") return null;
  const intent = (meta as { intent?: unknown }).intent;
  if (
    intent &&
    typeof intent === "object" &&
    "intentType" in intent &&
    typeof (intent as { intentType?: unknown }).intentType === "string"
  ) {
    return intent as IntentResult;
  }
  return null;
}
