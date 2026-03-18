import { cn } from "@/lib/utils";

function getHeatColor(score: number) {
  if (score >= 90) return "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/50";
  if (score >= 70) return "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/50";
  if (score >= 50) return "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/50";
  return "text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800/50";
}

export function HeatScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold",
        getHeatColor(score)
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {score}
    </span>
  );
}
