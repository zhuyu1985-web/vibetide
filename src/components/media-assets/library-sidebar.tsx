"use client";

import { useRouter } from "next/navigation";
import {
  User, Globe, Package, Trash2, HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryTree } from "./category-tree";
import type { MediaLibraryType, MediaCategoryNode } from "@/lib/types";

const libraryItems: { key: MediaLibraryType; label: string; icon: typeof User }[] = [
  { key: "personal", label: "个人库", icon: User },
  { key: "public", label: "公共库", icon: Globe },
  { key: "product", label: "成品库", icon: Package },
  { key: "recycle", label: "回收站", icon: Trash2 },
];

interface Props {
  activeLibrary: MediaLibraryType;
  activeCategoryId: string | null;
  categories: MediaCategoryNode[];
  storageDisplay?: string;
  onLibraryChange: (library: MediaLibraryType) => void;
  onCategorySelect: (categoryId: string | null) => void;
}

export function LibrarySidebar({
  activeLibrary, activeCategoryId, categories, storageDisplay,
  onLibraryChange, onCategorySelect,
}: Props) {
  return (
    <div className="w-[220px] shrink-0 flex flex-col h-full border-r border-[var(--glass-border)] bg-white/50 dark:bg-white/[0.02]">
      {/* Library nav */}
      <div className="p-3 space-y-0.5">
        <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 mb-2">
          资源库
        </p>
        {libraryItems.map((item) => {
          const Icon = item.icon;
          const active = activeLibrary === item.key;
          return (
            <button
              key={item.key}
              onClick={() => { onLibraryChange(item.key); onCategorySelect(null); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-colors",
                active
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
              )}
            >
              <Icon size={16} />
              <span className="flex-1 text-left truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Category tree (only for product library) */}
      {activeLibrary === "product" && categories.length > 0 && (
        <div className="flex-1 overflow-y-auto border-t border-[var(--glass-border)]">
          <div className="p-3">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 mb-2">
              栏目
            </p>
            <button
              onClick={() => onCategorySelect(null)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] transition-colors mb-1",
                !activeCategoryId
                  ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5"
              )}
            >
              全部栏目
            </button>
            <CategoryTree
              nodes={categories}
              activeCategoryId={activeCategoryId}
              onSelect={onCategorySelect}
            />
          </div>
        </div>
      )}

      {/* Storage usage */}
      {storageDisplay && (
        <div className="p-3 border-t border-[var(--glass-border)]">
          <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500">
            <HardDrive size={12} />
            <span>已用 {storageDisplay}</span>
          </div>
        </div>
      )}
    </div>
  );
}
