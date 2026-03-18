import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  SidePanelSkeleton,
  WorkflowSkeleton,
  MessageFeedSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3">
          <SidePanelSkeleton count={8} />
        </div>
        <div className="col-span-6 space-y-4">
          <WorkflowSkeleton />
          <WorkflowSkeleton />
          <MessageFeedSkeleton />
        </div>
        <div className="col-span-3 space-y-4">
          <SidePanelSkeleton />
          <div className="glass-card p-4 rounded-xl space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}
