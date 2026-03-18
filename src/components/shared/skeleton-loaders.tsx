import { Skeleton } from "@/components/ui/skeleton";

/* ─── Page Header ─── */
export function PageHeaderSkeleton({ hasActions = false }: { hasActions?: boolean }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      {hasActions && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      )}
    </div>
  );
}

/* ─── Stat Card ─── */
export function StatCardSkeleton() {
  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}

/* ─── Stats Row (N stat cards) ─── */
export function StatsRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="grid gap-4 mb-6"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ─── Toolbar (search + filter buttons) ─── */
export function ToolbarSkeleton() {
  return (
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <Skeleton className="h-9 w-[280px] rounded-md" />
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-md" />
        ))}
      </div>
    </div>
  );
}

/* ─── Card Grid (for skills, employee-marketplace, case-library, etc.) ─── */
export function CardGridSkeleton({
  count = 8,
  cols = 3,
}: {
  count?: number;
  cols?: number;
}) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-5 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Table Skeleton ─── */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Chart Skeleton ─── */
export function ChartSkeleton({ height = "h-[280px]" }: { height?: string }) {
  return (
    <div className="glass-card p-5 rounded-xl">
      <Skeleton className="h-5 w-32 mb-4" />
      <Skeleton className={`w-full rounded-lg ${height}`} />
    </div>
  );
}

/* ─── Tabs Skeleton ─── */
export function TabsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex items-center gap-1 mb-5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20 rounded-md" />
      ))}
    </div>
  );
}

/* ─── Detail Header (avatar + info, like employee detail) ─── */
export function DetailHeaderSkeleton() {
  return (
    <div className="glass-card p-6 rounded-xl mb-6">
      <div className="flex items-start gap-5">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/* ─── Detail Content (tabs + panels) ─── */
export function DetailContentSkeleton() {
  return (
    <div>
      <TabsSkeleton count={5} />
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-xl space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="glass-card p-5 rounded-xl space-y-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}

/* ─── Side Panel (like team-hub left panel) ─── */
export function SidePanelSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="glass-card p-3 rounded-xl space-y-2">
      <div className="flex items-center gap-2 px-2 py-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-5 w-16 rounded-full" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-2 py-2.5 rounded-lg"
        >
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-2 w-2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ─── Form Skeleton ─── */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="glass-card p-6 rounded-xl space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  );
}

/* ─── List Item (for simple list pages) ─── */
export function ListItemsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-4 rounded-xl flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-80" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Workflow Pipeline Skeleton ─── */
export function WorkflowSkeleton() {
  return (
    <div className="glass-card p-5 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="ml-auto h-5 w-20 rounded-full" />
      </div>
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-12 w-24 rounded-lg" />
            {i < 4 && <Skeleton className="h-0.5 w-6" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Message Feed Skeleton ─── */
export function MessageFeedSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="glass-card p-4 rounded-xl space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
