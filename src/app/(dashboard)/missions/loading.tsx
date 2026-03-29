import { Loader2 } from "lucide-react";

export default function MissionsLoading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded bg-gray-200 dark:bg-white/5" />
          <div className="h-4 w-64 rounded bg-gray-200 dark:bg-white/5" />
        </div>
        <div className="h-10 w-28 rounded-lg bg-gray-200 dark:bg-white/5" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-5 gap-3 mb-6 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="rounded-2xl bg-gray-100 dark:bg-white/[0.03] p-4 text-center">
            <div className="h-8 w-8 rounded bg-gray-200 dark:bg-white/5 mx-auto mb-1" />
            <div className="h-3 w-12 rounded bg-gray-200 dark:bg-white/5 mx-auto" />
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        <span className="ml-2 text-sm text-muted-foreground">加载任务列表...</span>
      </div>
    </div>
  );
}
