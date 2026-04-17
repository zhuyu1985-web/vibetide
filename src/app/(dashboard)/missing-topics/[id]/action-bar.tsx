"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import type { MissingTopicDetail } from "@/lib/types";

interface Props {
  detail: MissingTopicDetail;
}

export function ActionBar({ detail }: Props) {
  void detail; // available for future conditional logic

  return (
    <GlassCard padding="md" className="border-t-2 border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 shrink-0">
          处置操作：
        </span>

        <Button
          variant="ghost"
          size="sm"
          className="border-0 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          onClick={() => {
            // TODO: link to existing article
          }}
        >
          🔗 关联已有作品
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="border-0 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50"
          onClick={() => {
            // TODO: confirm as missed topic
          }}
        >
          ✅ 确认为漏题
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="border-0 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          onClick={() => {
            // TODO: exclude
          }}
        >
          🚫 排除
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="border-0 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          onClick={() => {
            // TODO: convert to topic
          }}
        >
          📋 转为选题
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        <Button
          size="sm"
          className="border-0 bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => {
            // TODO: push for handling
          }}
        >
          📤 推送处置
        </Button>
      </div>
    </GlassCard>
  );
}
