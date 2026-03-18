import { Skeleton } from "@/components/ui/skeleton";
import {
  DetailHeaderSkeleton,
  StatsRowSkeleton,
  TabsSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <DetailHeaderSkeleton />
      <StatsRowSkeleton count={4} />
      <TabsSkeleton count={7} />
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-xl space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="glass-card p-5 rounded-xl space-y-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
