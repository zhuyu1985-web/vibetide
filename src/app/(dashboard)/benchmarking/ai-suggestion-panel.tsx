"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles } from "lucide-react";

interface AISuggestionPanelProps {
  suggestions: { title: string; description: string; action?: string }[];
}

export function AISuggestionPanel({ suggestions }: AISuggestionPanelProps) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <EmployeeAvatar employeeId="xiaoce" size="sm" />
        <div className="flex items-center gap-1.5">
          <Lightbulb size={14} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            AI 对标建议
          </h3>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
          小策
        </span>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className="rounded-lg bg-gray-50/80 dark:bg-gray-800/50 p-3"
          >
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
              <Sparkles size={12} className="text-blue-500" />
              {suggestion.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              {suggestion.description}
            </p>
            {suggestion.action && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 h-7 px-2"
              >
                {suggestion.action}
              </Button>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
