import {
  PageHeaderSkeleton,
  StatsRowSkeleton,
  ChartSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <StatsRowSkeleton count={6} />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
