import type { IntentResult } from "@/lib/agent/types";
import { INTENT_TYPE_LABELS } from "@/lib/agent/types";

/**
 * 把 IntentResult 收敛成意图 chip 渲染所需的最小视图。
 * - typeLabel：intentType 的中文 label（未知值回退原值）
 * - employees：从 steps 提取的派单员工（按出现顺序去重）
 * - tentative：置信度 < 0.5 时标「待确认」
 *
 * 注意：employees 只给出 { slug, name }，头像/配色由组件侧用
 * resolveEmployeeVisual(slug) 解析（工种实例 slug 也能正确解析）。
 */
export interface IntentChipEmployee {
  slug: string;
  name: string;
}

export interface IntentChipView {
  typeLabel: string;
  employees: IntentChipEmployee[];
  tentative: boolean;
}

export function toIntentChipView(intent: IntentResult): IntentChipView {
  const seen = new Set<string>();
  const employees: IntentChipEmployee[] = [];
  for (const step of intent.steps ?? []) {
    if (!step.employeeSlug || seen.has(step.employeeSlug)) continue;
    seen.add(step.employeeSlug);
    employees.push({ slug: step.employeeSlug, name: step.employeeName });
  }
  return {
    typeLabel: INTENT_TYPE_LABELS[intent.intentType] ?? intent.intentType,
    employees,
    tentative: (intent.confidence ?? 1) < 0.5,
  };
}
