import {
  PageHeaderSkeleton,
  DetailHeaderSkeleton,
  TabsSkeleton,
  ListItemsSkeleton,
  ChartSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <DetailHeaderSkeleton />
      <TabsSkeleton count={4} />
      <div className="grid grid-cols-2 gap-4">
        <ListItemsSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
