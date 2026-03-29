"use client";

import { ResourceCard } from "./resource-card";
import type { MediaAssetFull } from "@/lib/types";

interface Props {
  assets: MediaAssetFull[];
  selectedIds: Set<string>;
  selectable: boolean;
  onSelect: (id: string) => void;
}

export function ResourceGrid({ assets, selectedIds, selectable, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
  );
}
