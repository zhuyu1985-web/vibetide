import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TopicPriority } from "@/lib/types";

const priorityConfig: Record<TopicPriority, { label: string; className: string }> = {
  P0: { label: "P0 必追", className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/30" },
  P1: { label: "P1 建议", className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/50" },
  P2: { label: "P2 关注", className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700" },
};

export function PriorityBadge({ priority }: { priority: TopicPriority }) {
  const config = priorityConfig[priority];
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
