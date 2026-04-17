import {
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function TopicCompareLoading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </div>
  );
}
