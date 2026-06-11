"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * 只在客户端挂载后渲染 children;挂载前(SSR + 首屏 hydration)渲染 fallback。
 *
 * 用途:把 Radix(Popover / Tooltip / DropdownMenu)等依赖 `useId` 的纯客户端
 * 交互包装层推迟到挂载后渲染。这些 hover/点击菜单本就不需要 SSR,而 Radix 的
 * `useId` 在 SSR ↔ 客户端之间生成的 `aria-controls`/`id` 偶发不一致,会触发
 * "hydration mismatch" 告警。fallback 渲染裸触发器(button/link),保证侧栏/顶栏
 * 首屏结构完整、无闪动;挂载后再套上 Radix 行为。
 */
export function MountGate({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <>{mounted ? children : fallback}</>;
}
