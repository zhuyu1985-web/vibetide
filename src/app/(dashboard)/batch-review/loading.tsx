import {
  PageHeaderSkeleton,
  TabsSkeleton,
  TableSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <TabsSkeleton count={3} />
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
