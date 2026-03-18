import {
  PageHeaderSkeleton,
  FormSkeleton,
} from "@/components/shared/skeleton-loaders";

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeaderSkeleton />
      <FormSkeleton fields={6} />
    </div>
  );
}
