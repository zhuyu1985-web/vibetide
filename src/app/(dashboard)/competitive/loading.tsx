import {
  PageHeaderSkeleton,
  TabsSkeleton,
  CardGridSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <TabsSkeleton count={3} />
      <CardGridSkeleton cols={2} count={4} />
    </div>
  );
}
