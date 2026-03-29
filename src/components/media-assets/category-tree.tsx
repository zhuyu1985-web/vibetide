"use client";

import { useState } from "react";
import { ChevronRight, FolderOpen, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaCategoryNode } from "@/lib/types";

interface Props {
  nodes: MediaCategoryNode[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  level?: number;
}

export function CategoryTree({ nodes, activeCategoryId, onSelect, level = 0 }: Props) {
  return (
    <div className={cn(level > 0 && "ml-3")}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          activeCategoryId={activeCategoryId}
          onSelect={onSelect}
          level={level}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node, activeCategoryId, onSelect, level,
}: {
  node: MediaCategoryNode;
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  level: number;
}) {
  const [expanded, setExpanded] = useState(level < 1);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeCategoryId === node.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-[5px] rounded-md cursor-pointer text-[13px] group transition-colors",
          isActive
            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
        )}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="w-4 h-4 flex items-center justify-center shrink-0"
          >
            <ChevronRight
              size={12}
              className={cn("transition-transform", expanded && "rotate-90")}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {expanded ? (
          <FolderOpen size={14} className="shrink-0 text-amber-500" />
        ) : (
          <Folder size={14} className="shrink-0 text-amber-400" />
        )}

        <span className="flex-1 truncate">{node.name}</span>
        <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
          {node.mediaAssetCount}
        </span>
      </div>

      {hasChildren && expanded && (
        <CategoryTree
          nodes={node.children as MediaCategoryNode[]}
          activeCategoryId={activeCategoryId}
          onSelect={onSelect}
          level={level + 1}
        />
      )}
    </div>
  );
}
