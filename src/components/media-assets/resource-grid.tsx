"use client";

import { useRef, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { ResourceCard } from "./resource-card";
import type { MediaAssetFull } from "@/lib/types";

interface Props {
  assets: MediaAssetFull[];
  selectedIds: Set<string>;
  selectable: boolean;
  onSelect: (id: string) => void;
  hasMore?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
}

export function ResourceGrid({
  assets, selectedIds, selectable, onSelect,
  hasMore, loading, onLoadMore,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || !onLoadMore || loading) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      { rootMargin: "200px" }
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [hasMore, loading, onLoadMore]);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset) => (
          <ResourceCard
            key={asset.id}
            asset={asset}
            selected={selectedIds.has(asset.id)}
            selectable={selectable}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex items-center justify-center py-8">
          {loading ? (
            <div className="flex items-center gap-2 text-[13px] text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              加载中...
            </div>
          ) : (
            <span className="text-[12px] text-gray-400">向下滚动加载更多</span>
          )}
        </div>
      )}

      {!hasMore && assets.length > 0 && (
        <div className="text-center py-6 text-[12px] text-gray-400 dark:text-gray-500">
          共 {assets.length} 项资源
        </div>
      )}
    </div>
  );
}
