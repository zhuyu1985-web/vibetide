import {
  PageHeaderSkeleton,
  StatsRowSkeleton,
  TableSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <StatsRowSkeleton count={4} />
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
