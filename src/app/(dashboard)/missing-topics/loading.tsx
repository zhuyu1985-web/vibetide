import { PageHeaderSkeleton, TableSkeleton } from "@/components/shared/skeleton-loaders";

export default function MissingTopicsLoading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-5 gap-3 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}
