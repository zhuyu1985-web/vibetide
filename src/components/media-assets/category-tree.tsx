"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, FolderOpen, Folder, Plus, Pencil, Trash2, Shield, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaCategoryNode } from "@/lib/types";

interface Props {
  nodes: MediaCategoryNode[];
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onCreateChild?: (parentId: string) => void;
  onRename?: (categoryId: string, newName: string) => void;
  onDelete?: (categoryId: string, name: string) => void;
  onPermission?: (categoryId: string, name: string) => void;
  level?: number;
}

export function CategoryTree({
  nodes, activeCategoryId, onSelect,
  onCreateChild, onRename, onDelete, onPermission,
  level = 0,
}: Props) {
  return (
    <div className={cn(level > 0 && "ml-3")}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          activeCategoryId={activeCategoryId}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onRename={onRename}
          onDelete={onDelete}
          onPermission={onPermission}
          level={level}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node, activeCategoryId, onSelect,
  onCreateChild, onRename, onDelete, onPermission,
  level,
}: {
  node: MediaCategoryNode;
  activeCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onCreateChild?: (parentId: string) => void;
  onRename?: (categoryId: string, newName: string) => void;
  onDelete?: (categoryId: string, name: string) => void;
  onPermission?: (categoryId: string, name: string) => void;
  level: number;
}) {
  const [expanded, setExpanded] = useState(level < 1);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeCategoryId === node.id;

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setEditValue(node.name);
    setEditing(true);
  };

  const confirmEdit = () => {
    const name = editValue.trim();
    if (name && name !== node.name && onRename) {
      onRename(node.id, name);
    }
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditValue(node.name);
  };

  return (
    <div>
      {editing ? (
        /* Inline edit mode */
        <div className="flex items-center gap-1 px-2 py-[3px]">
          <span className="w-4 shrink-0" />
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            onBlur={confirmEdit}
            className="flex-1 min-w-0 h-6 px-1.5 text-[12px] rounded bg-white dark:bg-gray-900 border border-blue-400 dark:border-blue-600 outline-none"
          />
          <button onClick={confirmEdit} className="w-5 h-5 flex items-center justify-center rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40">
            <Check size={12} />
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); cancelEdit(); }} className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X size={12} />
          </button>
        </div>
      ) : (
        /* Normal display mode */
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-[5px] rounded-md cursor-pointer text-[13px] group/node transition-colors",
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

          {/* Hover actions */}
          <span className="hidden group-hover/node:flex items-center gap-0.5 shrink-0">
            {onCreateChild && (
              <button
                onClick={(e) => { e.stopPropagation(); onCreateChild(node.id); }}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                title="新建子栏目"
              >
                <Plus size={12} />
              </button>
            )}
            {onPermission && (
              <button
                onClick={(e) => { e.stopPropagation(); onPermission(node.id, node.name); }}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
                title="权限设置"
              >
                <Shield size={11} />
              </button>
            )}
            {onRename && (
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(); }}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                title="重命名"
              >
                <Pencil size={11} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.name); }}
                className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                title="删除栏目"
              >
                <Trash2 size={11} />
              </button>
            )}
          </span>

          {/* Asset count (shown when not hovering) */}
          <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500 group-hover/node:hidden">
            {node.mediaAssetCount}
          </span>
        </div>
      )}

      {hasChildren && expanded && (
        <CategoryTree
          nodes={node.children as MediaCategoryNode[]}
          activeCategoryId={activeCategoryId}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onRename={onRename}
          onDelete={onDelete}
          onPermission={onPermission}
          level={level + 1}
        />
      )}
    </div>
  );
}
