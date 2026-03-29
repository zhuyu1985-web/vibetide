"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CategoryTree } from "./category-tree";
import type { MediaCategoryNode } from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  categories: MediaCategoryNode[];
  onConfirm: (categoryId: string) => void;
  loading?: boolean;
}

export function MoveToDialog({ open, onOpenChange, title, description, categories, onConfirm, loading }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] glass-panel">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-3">{description}</p>

        <div className="max-h-[300px] overflow-y-auto border rounded-lg p-2 bg-gray-50 dark:bg-white/[0.02]">
          {categories.length === 0 ? (
            <p className="text-[13px] text-gray-400 py-4 text-center">暂无栏目，请先创建栏目</p>
          ) : (
            <CategoryTree
              nodes={categories}
              activeCategoryId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 rounded-lg text-[13px] text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
          >
            取消
          </button>
          <button
            onClick={() => selectedId && onConfirm(selectedId)}
            disabled={!selectedId || loading}
            className="h-8 px-4 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "处理中..." : "确认"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
