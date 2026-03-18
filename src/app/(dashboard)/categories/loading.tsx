import {
  PageHeaderSkeleton,
  ListItemsSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <ListItemsSkeleton count={8} />
    </div>
  );
}
