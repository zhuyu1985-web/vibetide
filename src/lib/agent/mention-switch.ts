/**
 * A6 Phase 5 — `@employee` 切换协作 util
 *
 * chat-center stream route 入口在调 `assembleAgent` 前，跑 `detectMentionSwitch`
 * 拦截用户消息开头的 `@xiaolei ` / `@xiaoyan ` 等前缀，把对话切换到目标员工。
 *
 * 设计点：
 * - slug regex 从 EMPLOYEE_META 派生（不硬编码 9/12 员工名单），新增第 N 位员工不需改 regex
 * - cleanMessage 去掉 `@prefix `，避免 LLM 看到无关 token 浪费 context
 * - 失败语义（无 @ / @非法 slug）一致返回 `targetEmployee: null + cleanMessage = 原文`
 * - 不动 chat 架构（不挂到 intent-parser / intent-recognition），只在 stream route 入口预处理
 *
 * 参见：docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md §5
 */

import type { EmployeeId } from "@/lib/constants";
import { EMPLOYEE_META } from "@/lib/constants";

export function detectMentionSwitch(message: string): {
  targetEmployee: EmployeeId | null;
  cleanMessage: string;
} {
  // 从 EMPLOYEE_META 派生 slug 列表，避免硬编码（新增第 N 位员工不需改 regex）
  const slugs = Object.keys(EMPLOYEE_META).join("|");
  const re = new RegExp(`^@(${slugs})\\s+(.+)`, "s");
  const match = message.match(re);
  if (!match) return { targetEmployee: null, cleanMessage: message };
  return {
    targetEmployee: match[1] as EmployeeId,
    cleanMessage: match[2],
  };
}
