import { PageHeaderSkeleton } from "@/components/shared/skeleton-loaders";

export default function MissingDetailLoading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="h-96 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        <div className="h-96 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
      </div>
    </div>
  );
}
