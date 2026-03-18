import {
  PageHeaderSkeleton,
  TabsSkeleton,
  ListItemsSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <TabsSkeleton count={4} />
      <ListItemsSkeleton count={6} />
    </div>
  );
}
