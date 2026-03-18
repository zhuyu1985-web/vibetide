import {
  PageHeaderSkeleton,
  StatsRowSkeleton,
  ChartSkeleton,
  ListItemsSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <StatsRowSkeleton count={4} />
      <ChartSkeleton height="h-[320px]" />
      <ListItemsSkeleton count={4} />
    </div>
  );
}
