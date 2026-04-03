"use client";

import { useState, useRef, useEffect } from "react";
import {
  User, Globe, Package, Trash2, HardDrive, Plus, Check, X,
  Share2, Copyright, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryTree } from "./category-tree";
import type { MediaLibraryType, MediaCategoryNode } from "@/lib/types";

const libraryItems: { key: MediaLibraryType; label: string; icon: typeof User }[] = [
  { key: "personal", label: "个人库", icon: User },
  { key: "sharing", label: "共享库", icon: Share2 },
  { key: "public", label: "公共库", icon: Globe },
  { key: "copyright", label: "版权库", icon: Copyright },
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
  onCreateCategory?: (name: string, parentId?: string) => Promise<void>;
  onRenameCategory?: (categoryId: string, newName: string) => Promise<void>;
  onDeleteCategory?: (categoryId: string) => Promise<{ error?: string }>;
  onPermissionClick?: (categoryId: string, categoryName: string) => void;
}

export function LibrarySidebar({
  activeLibrary, activeCategoryId, categories, storageDisplay,
  onLibraryChange, onCategorySelect,
  onCreateCategory, onRenameCategory, onDeleteCategory, onPermissionClick,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | undefined>();
  const [newName, setNewName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  // Clear error after 3s
  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleStartCreate = (parentId?: string) => {
    setCreating(true);
    setCreateParentId(parentId);
    setNewName("");
    setDeleteConfirm(null);
  };

  const handleConfirmCreate = async () => {
    const name = newName.trim();
    if (!name || !onCreateCategory) return;
    await onCreateCategory(name, createParentId);
    setCreating(false);
    setNewName("");
  };

  const handleCancelCreate = () => {
    setCreating(false);
    setNewName("");
  };

  // Rename is now inline in TreeNode — just forward to parent
  const handleRenameCategory = (categoryId: string, newName: string) => {
    onRenameCategory?.(categoryId, newName);
  };

  const handleStartDelete = (categoryId: string, name: string) => {
    setDeleteConfirm({ id: categoryId, name });
    setCreating(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || !onDeleteCategory) return;
    const result = await onDeleteCategory(deleteConfirm.id);
    if (result?.error) {
      setError(result.error);
    }
    setDeleteConfirm(null);
  };

  const [categorySearch, setCategorySearch] = useState("");

  // Filter categories by search
  const filteredCategories = categorySearch
    ? categories.filter((c) => {
        const q = categorySearch.toLowerCase();
        const matchSelf = c.name.toLowerCase().includes(q);
        const matchChild = c.children?.some((ch) => ch.name.toLowerCase().includes(q));
        return matchSelf || matchChild;
      })
    : categories;

  return (
    <div className="w-[248px] shrink-0 flex flex-col h-full border-r border-[var(--glass-border)] bg-white/50 dark:bg-white/[0.02]">
      {/* Search box at top */}
      <div className="p-3 pb-0">
        <div className="relative mb-3">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索栏目"
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-gray-100/60 dark:bg-white/5 text-[12px] outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Library nav */}
      <div className="px-3 pb-2 space-y-0.5 overflow-y-auto">
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
      {activeLibrary === "product" && (
        <div className="flex-1 overflow-y-auto border-t border-[var(--glass-border)]">
          <div className="p-3">
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                栏目
              </p>
              {onCreateCategory && (
                <button
                  onClick={() => handleStartCreate()}
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                  title="新建一级栏目"
                >
                  <Plus size={13} />
                </button>
              )}
            </div>

            {/* Error toast */}
            {error && (
              <div className="mx-1 mb-2 px-2 py-1.5 rounded-md bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[11px]">
                {error}
              </div>
            )}

            {/* Delete confirm */}
            {deleteConfirm && (
              <div className="mx-1 mb-2 px-2 py-2 rounded-md bg-red-50 dark:bg-red-950/30 text-[12px]">
                <p className="text-red-600 dark:text-red-400 mb-1.5">
                  确认删除「{deleteConfirm.name}」？
                </p>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleConfirmDelete}
                    className="px-2 py-0.5 rounded bg-red-500 text-white text-[11px] hover:bg-red-600 transition-colors"
                  >
                    删除
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[11px] hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

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

            {/* New category inline input (root level) */}
            {creating && !createParentId && (
              <div className="mx-1 mb-1 flex items-center gap-1">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmCreate();
                    if (e.key === "Escape") handleCancelCreate();
                  }}
                  className="flex-1 min-w-0 h-7 px-2 text-[12px] rounded-md bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-700 outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="输入栏目名称..."
                />
                <button onClick={handleConfirmCreate} className="w-6 h-6 flex items-center justify-center rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40">
                  <Check size={13} />
                </button>
                <button onClick={handleCancelCreate} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X size={13} />
                </button>
              </div>
            )}

            {filteredCategories.length > 0 ? (
              <CategoryTree
                nodes={filteredCategories}
                activeCategoryId={activeCategoryId}
                onSelect={onCategorySelect}
                onCreateChild={onCreateCategory ? handleStartCreate : undefined}
                onRename={onRenameCategory ? handleRenameCategory : undefined}
                onDelete={onDeleteCategory ? handleStartDelete : undefined}
                onPermission={onPermissionClick}
              />
            ) : !creating && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center py-4">
                暂无栏目，点击 + 创建
              </p>
            )}

            {/* New category inline input (child level) */}
            {creating && createParentId && (
              <div className="ml-6 mt-1 flex items-center gap-1">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmCreate();
                    if (e.key === "Escape") handleCancelCreate();
                  }}
                  className="flex-1 min-w-0 h-7 px-2 text-[12px] rounded-md bg-white dark:bg-gray-900 border border-blue-300 dark:border-blue-700 outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="输入子栏目名称..."
                />
                <button onClick={handleConfirmCreate} className="w-6 h-6 flex items-center justify-center rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-950/40">
                  <Check size={13} />
                </button>
                <button onClick={handleCancelCreate} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X size={13} />
                </button>
              </div>
            )}
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
