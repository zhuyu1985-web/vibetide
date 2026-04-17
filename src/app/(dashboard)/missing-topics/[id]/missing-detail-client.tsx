"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { MissingTopicDetail } from "@/lib/types";
import { SourcePanel } from "./source-panel";
import { AnalysisPanel } from "./analysis-panel";
import { ActionBar } from "./action-bar";

/* ─── Status config ─── */

const statusConfig: Record<
  MissingTopicDetail["status"],
  { label: string; color: string }
> = {
  suspected: {
    label: "疑似漏题",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  confirmed: {
    label: "已确认漏题",
    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  covered: {
    label: "已覆盖",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  excluded: {
    label: "已排除",
    color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  pushed: {
    label: "已推送",
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

/* ─── Urgency config ─── */

const urgencyConfig: Record<
  MissingTopicDetail["urgency"],
  { label: string; color: string }
> = {
  urgent: { label: "🔴 紧急", color: "text-red-600" },
  normal: { label: "🟡 一般", color: "text-amber-600" },
  watch: { label: "🟢 关注", color: "text-green-600" },
};

/* ─── Component ─── */

interface Props {
  detail: MissingTopicDetail;
}

export function MissingDetailClient({ detail }: Props) {
  const st = statusConfig[detail.status];
  const ug = urgencyConfig[detail.urgency];

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* ── Breadcrumb & meta ── */}
      <div className="flex items-center justify-between mb-5">
        <Link
          href="/missing-topics"
          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
        >
          &larr; 返回漏题列表
        </Link>

        <div className="flex items-center gap-3">
          <Badge className={`border-0 ${st.color}`}>{st.label}</Badge>
          <span className={`text-sm font-medium ${ug.color}`}>{ug.label}</span>
        </div>
      </div>

      {/* ── Title ── */}
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-5">
        {detail.title}
      </h1>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <SourcePanel detail={detail} />
        <AnalysisPanel detail={detail} />
      </div>

      {/* ── Bottom action bar ── */}
      <ActionBar detail={detail} />
    </div>
  );
}
