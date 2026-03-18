import {
  PageHeaderSkeleton,
  StatsRowSkeleton,
  TabsSkeleton,
  ToolbarSkeleton,
  TableSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <StatsRowSkeleton count={5} />
      <TabsSkeleton count={5} />
      <ToolbarSkeleton />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
