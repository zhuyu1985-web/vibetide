"use client";

import * as React from "react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import type { EmployeeId } from "@/lib/constants";

interface Props {
  employeeId: EmployeeId | null;
  /** Slot above the card body (e.g. 状态行 + 技能徽章). */
  header?: React.ReactNode;
  /** Card body content. */
  children: React.ReactNode;
  /** Optional bubble-level styling override (e.g. red bubble for failed). */
  bodyClassName?: string;
}

/**
 * 三类 mission 气泡（planning / step / summary）共享的左头像 + 玻璃卡片外壳。
 * 抽出来后调风格只需改一处。pending/cancelled 等无卡片体的轻量行不走这里。
 */
export function MissionBubbleShell({
  employeeId,
  header,
  children,
  bodyClassName,
}: Props) {
  return (
    <div className="flex items-start gap-3">
      {employeeId && (
        <EmployeeAvatar
          employeeId={employeeId}
          size="sm"
          className="mt-0.5 flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        {header}
        <div
          className={
            bodyClassName
            ?? "bg-gradient-to-br from-white/90 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30 px-4 py-3"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
