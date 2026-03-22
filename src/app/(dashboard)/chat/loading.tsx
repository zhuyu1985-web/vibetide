export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-6">
      {/* Left panel skeleton */}
      <div className="w-[280px] border-r border-gray-200/40 dark:border-gray-700/40 p-4 space-y-4">
        {/* Search bar skeleton */}
        <div className="h-9 rounded-lg bg-gray-200/60 dark:bg-gray-700/40 animate-pulse" />
        {/* Tab skeleton */}
        <div className="flex gap-2">
          <div className="h-7 w-16 rounded-full bg-gray-200/60 dark:bg-gray-700/40 animate-pulse" />
          <div className="h-7 w-16 rounded-full bg-gray-200/60 dark:bg-gray-700/40 animate-pulse" />
        </div>
        {/* Employee list skeleton */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-gray-200/60 dark:bg-gray-700/40 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-20 rounded bg-gray-200/60 dark:bg-gray-700/40 animate-pulse" />
              <div className="h-3 w-28 rounded bg-gray-200/60 dark:bg-gray-700/40 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
      {/* Right panel skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 px-6 py-3.5 border-b border-gray-200/40 dark:border-gray-700/40">
          <div className="w-10 h-10 rounded-full bg-gray-200/60 dark:bg-gray-700/40 animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-4 w-24 rounded bg-gray-200/60 dark:bg-gray-700/40 animate-pulse" />
            <div className="h-3 w-32 rounded bg-gray-200/60 dark:bg-gray-700/40 animate-pulse" />
          </div>
        </div>
        {/* Message area skeleton */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-gray-200/60 dark:bg-gray-700/40 animate-pulse mx-auto" />
            <div className="h-4 w-40 rounded bg-gray-200/60 dark:bg-gray-700/40 animate-pulse mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
