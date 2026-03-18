import {
  PageHeaderSkeleton,
  StatsRowSkeleton,
  ListItemsSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <StatsRowSkeleton count={3} />
      <ListItemsSkeleton count={6} />
    </div>
  );
}
