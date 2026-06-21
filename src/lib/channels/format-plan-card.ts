import type { IntentStep } from "@/lib/agent/types";

/** 把规划好的 steps 渲染成「计划确认卡」文本，发给 IM 让用户确认/改。 */
export function formatPlanCard(summary: string, steps: IntentStep[]): string {
  const lines = steps.map((s, i) => `${i + 1}. ${s.taskDescription}`).join("\n");
  return [
    `📋 我将：${summary}`,
    lines,
    `回复 开始 执行，或直接说要改的地方（如"换财经""加配图"）。`,
  ]
    .filter(Boolean)
    .join("\n");
}
