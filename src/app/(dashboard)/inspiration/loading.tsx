import {
  PageHeaderSkeleton,
  ToolbarSkeleton,
  CardGridSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <ToolbarSkeleton />
      <CardGridSkeleton cols={3} count={9} />
    </div>
  );
}
