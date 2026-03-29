"use client";

import { ResourceRow } from "./resource-row";
import type { MediaAssetFull } from "@/lib/types";

interface Props {
  assets: MediaAssetFull[];
  selectedIds: Set<string>;
  selectable: boolean;
  onSelect: (id: string) => void;
}

export function ResourceList({ assets, selectedIds, selectable, onSelect }: Props) {
  return (
    <div className="space-y-0.5">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 text-[11px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">
        {selectable && <div className="w-5 shrink-0" />}
        <div className="w-10 shrink-0" />
        <div className="flex-1">名称</div>
        <div className="w-12 shrink-0">类型</div>
        <div className="w-20 shrink-0">创建人</div>
        <div className="w-24 shrink-0">创建时间</div>
        <div className="w-16 shrink-0 text-right">大小</div>
      </div>

      {assets.map((asset) => (
        <ResourceRow
          key={asset.id}
          asset={asset}
          selected={selectedIds.has(asset.id)}
          selectable={selectable}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
