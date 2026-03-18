import {
  PageHeaderSkeleton,
  StatsRowSkeleton,
  TabsSkeleton,
  TableSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <StatsRowSkeleton count={4} />
      <TabsSkeleton count={3} />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
