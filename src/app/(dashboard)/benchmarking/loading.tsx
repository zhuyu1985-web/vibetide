import {
  PageHeaderSkeleton,
  TabsSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <TabsSkeleton count={3} />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
