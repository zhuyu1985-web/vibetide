"use client";

import { CheckCircle, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  time: string;
  title: string;
  description?: string;
  status: "completed" | "active" | "pending";
}

export function TimelineStep({ items }: { items: TimelineItem[] }) {
  return (
    <div className="relative space-y-0">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={i} className="relative flex gap-3 pb-4">
            {/* Vertical line */}
            {!isLast && (
              <div
                className={cn(
                  "absolute left-[9px] top-5 w-0.5 h-[calc(100%-8px)]",
                  item.status === "completed" ? "bg-green-300" : "bg-gray-200 dark:bg-gray-700"
                )}
              />
            )}
            {/* Icon */}
            <div className="relative z-10 mt-0.5 shrink-0">
              {item.status === "completed" ? (
                <CheckCircle size={18} className="text-green-500" />
              ) : item.status === "active" ? (
                <Loader2 size={18} className="text-blue-500 animate-spin" />
              ) : (
                <Circle size={18} className="text-gray-300 dark:text-gray-600" />
              )}
            </div>
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{item.time}</span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    item.status === "completed"
                      ? "text-gray-600 dark:text-gray-400"
                      : item.status === "active"
                      ? "text-blue-700 dark:text-blue-400"
                      : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  {item.title}
                </span>
              </div>
              {item.description && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{item.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
