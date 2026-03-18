import {
  PageHeaderSkeleton,
  DetailHeaderSkeleton,
  DetailContentSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <DetailHeaderSkeleton />
      <DetailContentSkeleton />
    </div>
  );
}
