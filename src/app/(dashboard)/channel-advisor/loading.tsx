import {
  PageHeaderSkeleton,
  ToolbarSkeleton,
  CardGridSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton hasActions />
      <ToolbarSkeleton />
      <CardGridSkeleton cols={2} count={6} />
    </div>
  );
}
