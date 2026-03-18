import {
  PageHeaderSkeleton,
  StatsRowSkeleton,
  ToolbarSkeleton,
  CardGridSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <StatsRowSkeleton count={3} />
      <ToolbarSkeleton />
      <CardGridSkeleton cols={3} count={6} />
    </div>
  );
}
