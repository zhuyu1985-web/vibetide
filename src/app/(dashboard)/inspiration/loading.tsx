import { Skeleton } from "@/components/ui/skeleton";

export default function InspirationLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel Skeleton */}
        <div className="w-[45%] flex flex-col border-r border-white/10 p-4 space-y-4">
          {/* Summary bar skeleton */}
          <Skeleton className="h-24 w-full rounded-lg" />
          {/* Tab bar skeleton */}
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          {/* Topic list skeletons */}
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        {/* Right Panel Skeleton */}
        <div className="w-[55%] flex flex-col p-6 space-y-4">
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
      {/* Bottom bar skeleton */}
      <div className="border-t border-white/10 px-4 py-2">
        <div className="flex gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-24 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
