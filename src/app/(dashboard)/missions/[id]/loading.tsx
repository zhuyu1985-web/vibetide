import { Loader2 } from "lucide-react";

export default function MissionDetailLoading() {
  return (
    <div className="max-w-[1600px] mx-auto space-y-5">
      {/* Header skeleton */}
      <div className="rounded-2xl bg-gray-100 dark:bg-white/[0.03] p-5 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-md bg-gray-200 dark:bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-64 rounded bg-gray-200 dark:bg-white/5" />
            <div className="h-3 w-32 rounded bg-gray-200 dark:bg-white/5" />
          </div>
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-white/5" />
        </div>
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/5 flex justify-center gap-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-white/5" />
              <div className="h-3 w-8 rounded bg-gray-200 dark:bg-white/5" />
            </div>
          ))}
        </div>
      </div>

      {/* 3-column skeleton */}
      <div className="flex gap-5 items-start">
        {/* Left */}
        <div className="w-[220px] shrink-0 rounded-2xl bg-gray-100 dark:bg-white/[0.03] p-4 space-y-3 animate-pulse">
          <div className="h-4 w-20 rounded bg-gray-200 dark:bg-white/5" />
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2.5 p-2">
              <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-white/5" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-12 rounded bg-gray-200 dark:bg-white/5" />
                <div className="h-2.5 w-16 rounded bg-gray-200 dark:bg-white/5" />
              </div>
            </div>
          ))}
        </div>

        {/* Center */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            <span className="ml-2 text-sm text-muted-foreground">加载任务详情...</span>
          </div>
        </div>

        {/* Right */}
        <div className="w-[260px] shrink-0 space-y-4 animate-pulse">
          <div className="rounded-2xl bg-gray-100 dark:bg-white/[0.03] p-4 space-y-3">
            <div className="h-4 w-20 rounded bg-gray-200 dark:bg-white/5" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 w-full rounded bg-gray-200 dark:bg-white/5" />
            ))}
          </div>
          <div className="rounded-2xl bg-gray-100 dark:bg-white/[0.03] p-4 space-y-3">
            <div className="h-4 w-20 rounded bg-gray-200 dark:bg-white/5" />
            <div className="grid grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded bg-gray-200 dark:bg-white/5" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
